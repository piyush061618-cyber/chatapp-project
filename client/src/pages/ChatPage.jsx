import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Picker from 'emoji-picker-react';
import {
  BsEmojiSmileFill,
  BsTrash,
  BsVolumeUpFill,
  BsVolumeMuteFill,
  BsCheck2All,
  BsChatDotsFill,
  BsHash,
  BsPaperclip,
  BsSearch,
  BsReplyFill,
  BsX,
  BsDownload,
  BsFileEarmarkTextFill,
  BsCloudArrowUpFill,
  BsArrowUpCircle,
  BsCommand,
  BsPerson,
  BsPinAngleFill,
  BsPinFill,
  BsCameraVideoFill,
  BsTelephoneFill,
  BsMicFill,
  BsList,
  BsThreeDotsVertical
} from 'react-icons/bs';
import { MdVerified } from 'react-icons/md';
import { IoSend } from 'react-icons/io5';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import socket from '../socket';
import './ChatPage.css';
import VoiceRecorder from '../components/VoiceRecorder';
import AudioWaveformPlayer from '../components/AudioWaveformPlayer';
import IncomingCallDialog from '../components/IncomingCallDialog';
import CallModal from '../components/CallModal';


// Web Audio API Sound Effects
class SoundEffects {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playSend() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }
  playReceive() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const playTone = (freq, start, duration) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + start);
        gain.gain.setValueAtTime(0.15, t + start);
        gain.gain.exponentialRampToValueAtTime(0.001, t + start + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + duration);
      };
      playTone(659.25, 0, 0.1);
      playTone(880, 0.08, 0.16);
    } catch (e) {}
  }
  playDelete() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {}
  }
}

const sounds = new SoundEffects();
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉'];

const getDmRoom = (userA, userB) => {
  return 'dm__' + [userA, userB].sort().join('__');
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDividerDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const isSameSenderWithin3Min = (currentMsg, prevMsg) => {
  if (!prevMsg) return false;
  if (currentMsg.author !== prevMsg.author) return false;
  if (currentMsg.isDeleted || prevMsg.isDeleted) return false;
  if (currentMsg.replyTo) return false; // Quoted reply starts a new visual block
  const timeDiff = new Date(currentMsg.timestamp) - new Date(prevMsg.timestamp);
  return timeDiff >= 0 && timeDiff <= 3 * 60 * 1000;
};

function ChatPage() {
  const [room, setRoom] = useState('general');
  const [activeDmUser, setActiveDmUser] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);
  const [onlineUsersMap, setOnlineUsersMap] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [showPicker, setShowPicker] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [myStatus, setMyStatus] = useState('online');
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [stagedFile, setStagedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [previewImageModal, setPreviewImageModal] = useState(null);

  // Phase 5 Pagination
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Phase 6 Quick Switcher Modal (Ctrl+K)
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [quickSwitcherQuery, setQuickSwitcherQuery] = useState('');
  const [switcherSelectedIndex, setSwitcherSelectedIndex] = useState(0);
  const [rateLimitToast, setRateLimitToast] = useState(null);

  // Phase 8: Pinned Messages, Voice Notes & WebRTC Calling
  const [pinnedMessage, setPinnedMessage] = useState(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callState, setCallState] = useState({
    isActive: false,
    isCaller: false,
    targetUser: null,
    callType: 'video',
    signal: null,
  });

  // Mobile Responsiveness States
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('chat_sound_enabled') !== 'false';
  });

  const chatBodyRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isInitialLoadRef = useRef(true);

  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const getUsernameFromToken = () => {
    try {
      if (user?.username) return user.username;
      if (!token) return 'Guest';
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.username || decoded.user?.username || 'Guest';
    } catch (e) {
      return 'Guest';
    }
  };
  const username = user?.username || getUsernameFromToken();
  const myAvatar = user?.avatar || `https://api.dicebear.com/8.x/adventurer/svg?seed=${username}`;

  const activeRoomName = activeDmUser ? getDmRoom(username, activeDmUser) : room;

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('chat_sound_enabled', String(next));
      return next;
    });
  };

  const handleStatusChange = (status) => {
    setMyStatus(status);
    setShowStatusMenu(false);
    if (socket) socket.emit('status_change', { status });
  };

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickSwitcher((prev) => !prev);
        setQuickSwitcherQuery('');
        setSwitcherSelectedIndex(0);
      } else if (e.key === 'Escape') {
        setShowQuickSwitcher(false);
        setPreviewImageModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, usersRes] = await Promise.all([
          axios.get('http://localhost:3001/api/rooms'),
          axios.get('http://localhost:3001/api/auth/users')
        ]);
        const customRooms = (roomsRes.data || []).filter(
          (r) => !r.startsWith('dm__') && !r.startsWith('user_')
        );
        if (!customRooms.includes('general')) customRooms.unshift('general');
        setAvailableRooms(customRooms);
        setAllRegisteredUsers((usersRes.data || []).filter((u) => u.username !== username));
      } catch (err) {
        console.error('Failed to load rooms or users:', err);
      }
    };
    fetchData();
  }, [username]);

  // Scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current && !searchQuery) {
      if (isInitialLoadRef.current) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
        isInitialLoadRef.current = false;
      } else if (!isLoadingMore) {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      }
    }
  }, [chatHistory, typingUsers, searchQuery]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !showChat) return;

    socket.connect();

    const handleGlobalUsers = (usersList) => {
      const map = {};
      usersList.forEach((u) => {
        map[u.username] = u.status || 'online';
      });
      setOnlineUsersMap(map);
    };
    socket.on('global_users_update', handleGlobalUsers);

    const handleReceiveMessage = (data) => {
      const isCurrentConversation =
        data.room === (activeDmUser ? getDmRoom(username, activeDmUser) : room);

      if (isCurrentConversation) {
        setChatHistory((list) => {
          if (data._id && list.some((m) => m._id === data._id)) return list;
          const isMe = Boolean(
            (data.author && username && data.author.trim().toLowerCase() === username.trim().toLowerCase()) ||
            (data.senderId && user?._id && String(data.senderId) === String(user._id)) ||
            (data.senderId && user?.id && String(data.senderId) === String(user.id))
          );
          return [...list, { ...data, fromMe: isMe }];
        });
      } else {
        const badgeKey = data.room.startsWith('dm__') ? data.author : data.room;
        setUnreadCounts((prev) => ({
          ...prev,
          [badgeKey]: (prev[badgeKey] || 0) + 1
        }));
      }

      if (soundEnabled && data.author !== username) {
        sounds.playReceive();
      }
    };

    const handleLoadHistory = (payload) => {
      const rawList = Array.isArray(payload) ? payload : (payload?.history || []);
      const formatted = rawList.map((msg) => {
        const isMe = Boolean(
          (msg.author && username && msg.author.trim().toLowerCase() === username.trim().toLowerCase()) ||
          (msg.senderId && user?._id && String(msg.senderId) === String(user._id)) ||
          (msg.senderId && user?.id && String(msg.senderId) === String(user.id))
        );
        return { ...msg, fromMe: isMe };
      });
      setChatHistory(formatted);
      setHasMore(Boolean(payload?.hasMore));
      if (payload?.pinnedMessage !== undefined) {
        setPinnedMessage(payload.pinnedMessage);
      }
      setIsLoadingMore(false);
      isInitialLoadRef.current = true;
    };

    const handleMoreMessagesLoaded = (payload) => {
      const newMessages = (payload?.messages || []).map((msg) => {
        const isMe = Boolean(
          (msg.author && username && msg.author.trim().toLowerCase() === username.trim().toLowerCase()) ||
          (msg.senderId && user?._id && String(msg.senderId) === String(user._id)) ||
          (msg.senderId && user?.id && String(msg.senderId) === String(user.id))
        );
        return { ...msg, fromMe: isMe };
      });

      if (chatBodyRef.current) {
        const currentScrollHeight = chatBodyRef.current.scrollHeight;
        setChatHistory((prev) => [...newMessages, ...prev]);
        setHasMore(Boolean(payload?.hasMore));
        setIsLoadingMore(false);

        setTimeout(() => {
          if (chatBodyRef.current) {
            chatBodyRef.current.scrollTop =
              chatBodyRef.current.scrollHeight - currentScrollHeight;
          }
        }, 10);
      }
    };

    const handleUserTyping = (typingUsername) => {
      setTypingUsers((prev) => {
        if (!prev.includes(typingUsername) && typingUsername !== username) {
          return [...prev, typingUsername];
        }
        return prev;
      });
    };

    const handleUserStoppedTyping = (stoppedUsername) => {
      setTypingUsers((prev) => prev.filter((u) => u !== stoppedUsername));
    };

    const handleMessageDeleted = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId
            ? {
                ...msg,
                isDeleted: true,
                message: 'This message was deleted',
                attachment: null,
                reactions: []
              }
            : msg
        )
      );
      if (soundEnabled) sounds.playDelete();
    };

    const handleReactionUpdated = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('load_history', handleLoadHistory);
    socket.on('more_messages_loaded', handleMoreMessagesLoaded);

    const handleRateLimit = (data) => {
      setRateLimitToast(data.message || 'Slow down! Rate limit exceeded.');
      setTimeout(() => setRateLimitToast(null), 3500);
    };
    socket.on('rate_limit_exceeded', handleRateLimit);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);

    // Pinned messages broadcast
    const handleMessagePinned = (data) => {
      setChatHistory((list) =>
        list.map((m) => (String(m._id) === String(data.messageId) ? { ...m, isPinned: data.isPinned } : m))
      );
      if (data.isPinned) {
        setPinnedMessage(data.message);
      } else if (pinnedMessage && String(pinnedMessage._id) === String(data.messageId)) {
        setPinnedMessage(null);
      }
    };
    socket.on('message_pinned', handleMessagePinned);

    // WebRTC Incoming Call listener
    const handleCallIncoming = (data) => {
      setIncomingCall(data);
    };
    socket.on('call_incoming', handleCallIncoming);

    return () => {
      socket.off('global_users_update', handleGlobalUsers);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('load_history', handleLoadHistory);
      socket.off('more_messages_loaded', handleMoreMessagesLoaded);
      socket.off('rate_limit_exceeded', handleRateLimit);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('call_incoming', handleCallIncoming);
    };
  }, [socket, showChat, username, activeDmUser, room, soundEnabled]);


  // Pinned Messages Handlers
  const handleTogglePin = (messageId) => {
    socket.emit('pin_message', { messageId, room: activeRoomName });
  };

  const scrollToMessage = (msgId) => {
    const el = document.getElementById(`msg_${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash-highlight');
      setTimeout(() => el.classList.remove('flash-highlight'), 2000);
    }
  };

  // Voice Notes Handler
  const handleSendVoiceNote = (audioAttachment) => {
    setIsRecordingVoice(false);
    const tempId = 'temp_' + Date.now();
    const clientMessageId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const messageData = {
      room: activeRoomName,
      message: '',
      clientMessageId,
      attachment: audioAttachment,
      replyTo: null,
    };

    const localMsg = {
      _id: tempId,
      room: activeRoomName,
      message: '',
      attachment: audioAttachment,
      author: username,
      senderId: user?.id || null,
      clientMessageId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      fromMe: true,
      reactions: [],
      isDeleted: false,
    };
    setChatHistory((list) => [...list, localMsg]);

    socket.emit('send_message', messageData, (response) => {
      if (response && response.status === 'ok' && response.message) {
        setChatHistory((list) =>
          list.map((m) => (m._id === tempId ? { ...response.message, fromMe: true } : m))
        );
      }
    });

    if (soundEnabled) sounds.playSend();
    if (chatBodyRef.current) {
      setTimeout(() => {
        chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
      }, 50);
    }
  };

  // WebRTC Calling Handlers
  const startCall = (type) => {
    if (!activeDmUser) return;
    setCallState({
      isActive: true,
      isCaller: true,
      targetUser: activeDmUser,
      callType: type, // 'video' or 'audio'
      signal: null,
    });
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    setCallState({
      isActive: true,
      isCaller: false,
      targetUser: incomingCall.from,
      callType: incomingCall.callType || 'video',
      signal: incomingCall.signal,
    });
    setIncomingCall(null);
  };

  const declineCall = () => {
    if (incomingCall) {
      socket.emit('end_call', { to: incomingCall.from });
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    setCallState({
      isActive: false,
      isCaller: false,
      targetUser: null,
      callType: 'video',
      signal: null,
    });
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore || chatHistory.length === 0) return;
    setIsLoadingMore(true);
    const oldestMsg = chatHistory[0];
    socket.emit('load_more_messages', {
      room: activeRoomName,
      beforeTimestamp: oldestMsg.timestamp
    });
  };

  const handleChatScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore && !isLoadingMore && !searchQuery) {
      handleLoadMore();
    }
  };

  const switchChannel = (targetChannel) => {
    setActiveDmUser(null);
    setRoom(targetChannel);
    setChatHistory([]);
    setReplyingTo(null);
    setStagedFile(null);
    setHasMore(false);
    isInitialLoadRef.current = true;
    setShowQuickSwitcher(false);
    setUnreadCounts((prev) => ({ ...prev, [targetChannel]: 0 }));
    socket.emit('join_room', { room: targetChannel });
    setShowChat(true);
  };

  const startDirectMessage = (targetUser) => {
    setActiveDmUser(targetUser);
    setChatHistory([]);
    setReplyingTo(null);
    setStagedFile(null);
    setHasMore(false);
    isInitialLoadRef.current = true;
    setShowQuickSwitcher(false);
    setUnreadCounts((prev) => ({ ...prev, [targetUser]: 0 }));
    const dmRoom = getDmRoom(username, targetUser);
    socket.emit('join_room', { room: dmRoom });
    setShowChat(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert('File is too large! Please choose a file smaller than 20MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setStagedFile({
      file,
      name: file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      fileType: file.type,
      size: file.size,
      previewUrl
    });

    e.target.value = '';
  };

  const sendMessage = async () => {
    const hasText = Boolean(currentMessage.trim());
    const hasFile = Boolean(stagedFile);

    if (!hasText && !hasFile) return;

    let attachmentData = null;

    if (stagedFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', stagedFile.file);

        const uploadRes = await axios.post('http://localhost:3001/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (uploadRes.data && uploadRes.data.url) {
          attachmentData = {
            name: uploadRes.data.name,
            type: uploadRes.data.type,
            fileType: uploadRes.data.fileType,
            size: uploadRes.data.size,
            url: uploadRes.data.url
          };
        }
      } catch (err) {
        console.error('File upload failed:', err);
        alert('Failed to upload file. Please try again.');
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const targetRoom = activeRoomName;
    const tempId = 'temp_' + Date.now();
    const clientMessageId = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const messageData = {
      room: targetRoom,
      message: currentMessage.trim(),
      clientMessageId,
      attachment: attachmentData,
      replyTo: replyingTo
        ? {
            messageId: replyingTo.id,
            author: replyingTo.author,
            text: replyingTo.text
          }
        : null
    };

    if (soundEnabled) sounds.playSend();

    const localMsg = {
      _id: tempId,
      room: targetRoom,
      message: currentMessage.trim(),
      author: username,
      attachment: attachmentData,
      replyTo: messageData.replyTo,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: new Date().toISOString(),
      fromMe: true,
      reactions: [],
      isDeleted: false
    };
    setChatHistory((list) => [...list, localMsg]);

    socket.emit('send_message', messageData, (response) => {
      if (response && response.status === 'ok' && response.message) {
        setChatHistory((list) =>
          list.map((m) => (m._id === tempId ? { ...response.message, fromMe: true } : m))
        );
      }
    });

    setCurrentMessage('');
    setStagedFile(null);
    setReplyingTo(null);
    socket.emit('stop_typing', { room: targetRoom });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    const targetRoom = activeRoomName;
    if (e.target.value) {
      socket.emit('typing', { room: targetRoom });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit('stop_typing', { room: targetRoom });
      }, 2000);
    } else {
      socket.emit('stop_typing', { room: targetRoom });
    }
  };

  const handleDeleteMessage = (msgId) => {
    if (!msgId) return;
    if (window.confirm('Delete this message for everyone?')) {
      socket.emit('delete_message', { messageId: msgId, room: activeRoomName });
    }
  };

  const handleToggleReaction = (msgId, emoji) => {
    if (!msgId || !emoji) return;
    socket.emit('add_reaction', { messageId: msgId, room: activeRoomName, emoji });
  };

  const scrollToQuotedMessage = (messageId) => {
    if (!messageId) return;
    const elem = document.getElementById('msg_' + messageId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elem.classList.add('flash-highlight');
      setTimeout(() => elem.classList.remove('flash-highlight'), 1800);
    }
  };

  const groupReactions = (reactions = []) => {
    const map = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [], hasReacted: false };
      map[r.emoji].count += 1;
      map[r.emoji].users.push(r.username);
      if (r.username === username) map[r.emoji].hasReacted = true;
    });
    return map;
  };

  const onEmojiClick = (emojiObject) => {
    setCurrentMessage((prev) => prev + emojiObject.emoji);
    setShowPicker(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter messages based on search query
  const displayedHistory = chatHistory.filter((msg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const textMatch = msg.message && msg.message.toLowerCase().includes(q);
    const authorMatch = msg.author && msg.author.toLowerCase().includes(q);
    const attachmentMatch = msg.attachment?.name && msg.attachment.name.toLowerCase().includes(q);
    return textMatch || authorMatch || attachmentMatch;
  });

  // Quick Switcher search items
  const switcherChannels = availableRooms
    .filter((r) => r.toLowerCase().includes(quickSwitcherQuery.toLowerCase()))
    .map((r) => ({ type: 'channel', name: r }));

  const switcherUsers = allRegisteredUsers
    .filter((u) => u.username.toLowerCase().includes(quickSwitcherQuery.toLowerCase()))
    .map((u) => ({ type: 'user', name: u.username }));

  const allSwitcherItems = [...switcherChannels, ...switcherUsers];

  const handleSwitcherKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSwitcherSelectedIndex((prev) => (prev + 1) % (allSwitcherItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSwitcherSelectedIndex((prev) =>
        prev === 0 ? Math.max(allSwitcherItems.length - 1, 0) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = allSwitcherItems[switcherSelectedIndex];
      if (selected) {
        if (selected.type === 'channel') switchChannel(selected.name);
        else startDirectMessage(selected.name);
      }
    }
  };

  if (!showChat) {
    return (
      <div className="join-view-wrapper">
        <div className="join-chat-card">
          <div className="join-card-header">
            <div className="user-pill">
              <img
                src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${username}`}
                alt="avatar"
                className="user-pill-avatar"
              />
              <span className="user-pill-name">{username}</span>
              <MdVerified className="verified-tick" />
            </div>
            <h2>Pulse Chat</h2>
            <p className="join-subtitle">Connect with public channels and encrypted 1-on-1 direct messages</p>
          </div>

          <div className="join-input-group">
            <input
              type="text"
              placeholder="Enter room name (e.g. general, tech)..."
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && switchChannel(room)}
              className="join-room-input"
            />
            <button onClick={() => switchChannel(room)} className="join-room-btn">
              Enter Channel →
            </button>
          </div>

          <div className="available-rooms-section">
            <div className="rooms-section-title">
              <span>Public Channels</span>
              <span className="room-count-badge">{availableRooms.length}</span>
            </div>
            <div className="room-chips-grid">
              {availableRooms.map((r) => (
                <button
                  key={r}
                  onClick={() => switchChannel(r)}
                  className="room-chip"
                >
                  <span className="room-hash">#</span>
                  <span className="room-name-text">{r}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="available-rooms-section">
            <div className="rooms-section-title">
              <span>Direct Messages (1-on-1)</span>
              <span className="room-count-badge">{allRegisteredUsers.length}</span>
            </div>
            <div className="dm-chips-grid">
              {allRegisteredUsers.length > 0 ? (
                allRegisteredUsers.map((u) => {
                  const status = onlineUsersMap[u.username] || 'offline';
                  return (
                    <button
                      key={u._id}
                      onClick={() => startDirectMessage(u.username)}
                      className="dm-chip"
                    >
                      <span className={`status-dot ${status}`} />
                      <span className="dm-chip-name">{u.username}</span>
                    </button>
                  );
                })
              ) : (
                <p className="no-rooms-hint">No other registered users yet.</p>
              )}
            </div>
          </div>

          <button onClick={handleLogout} className="join-logout-btn">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const isDirectMessage = Boolean(activeDmUser);
  const activeDmStatus = activeDmUser ? onlineUsersMap[activeDmUser] || 'offline' : null;

  return (
    <div className="chat-layout">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept="image/*,application/pdf,.doc,.docx,.txt"
      />

      {/* Quick Switcher Modal (Ctrl+K) */}
      {showQuickSwitcher && (
        <div className="spotlight-overlay" onClick={() => setShowQuickSwitcher(false)}>
          <div className="spotlight-modal" onClick={(e) => e.stopPropagation()}>
            <div className="spotlight-search-header">
              <BsSearch className="spotlight-icon" />
              <input
                type="text"
                className="spotlight-input"
                placeholder="Jump to channel or direct message... (↑ ↓ Enter)"
                value={quickSwitcherQuery}
                onChange={(e) => {
                  setQuickSwitcherQuery(e.target.value);
                  setSwitcherSelectedIndex(0);
                }}
                onKeyDown={handleSwitcherKeyDown}
                autoFocus
              />
              <span className="spotlight-esc-pill">Esc</span>
            </div>
            <div className="spotlight-results">
              {allSwitcherItems.length > 0 ? (
                allSwitcherItems.map((item, idx) => (
                  <div
                    key={item.type + item.name}
                    className={`spotlight-item ${idx === switcherSelectedIndex ? 'selected' : ''}`}
                    onClick={() => {
                      if (item.type === 'channel') switchChannel(item.name);
                      else startDirectMessage(item.name);
                    }}
                    onMouseEnter={() => setSwitcherSelectedIndex(idx)}
                  >
                    <div className="spotlight-item-left">
                      {item.type === 'channel' ? (
                        <BsHash className="item-type-icon channel" />
                      ) : (
                        <span className={`status-dot ${onlineUsersMap[item.name] || 'offline'}`} />
                      )}
                      <span className="spotlight-item-name">
                        {item.type === 'channel' ? item.name : '@' + item.name}
                      </span>
                    </div>
                    <span className="spotlight-item-badge">{item.type}</span>
                  </div>
                ))
              ) : (
                <div className="spotlight-empty">No channels or users match "{quickSwitcherQuery}"</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {previewImageModal && (
        <div className="lightbox-overlay" onClick={() => setPreviewImageModal(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={previewImageModal} alt="Preview" className="lightbox-img" />
            <button className="lightbox-close-btn" onClick={() => setPreviewImageModal(null)}>
              <BsX />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Backdrop Overlay on Mobile */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`chat-sidebar ${mobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="brand-dot" />
            <h3>PulseChat</h3>
          </div>
          <button
            type="button"
            className="sidebar-close-btn-mobile"
            onClick={() => setMobileSidebarOpen(false)}
            title="Close sidebar"
          >
            <BsX />
          </button>
        </div>

        {/* Quick Switcher Trigger Button */}
        <button
          type="button"
          className="sidebar-quick-switcher-btn"
          onClick={() => setShowQuickSwitcher(true)}
          title="Press Ctrl+K to jump anywhere"
        >
          <div className="quick-btn-left">
            <BsSearch />
            <span>Jump to...</span>
          </div>
          <span className="kbd-shortcut">Ctrl K</span>
        </button>

        {/* Public Channels */}
        <div className="sidebar-group">
          <div className="group-header">
            <span className="group-label">Channels</span>
          </div>
          <ul className="sidebar-items-list">
            {availableRooms.map((ch) => {
              const isActive = !isDirectMessage && room === ch;
              const unread = unreadCounts[ch] || 0;
              return (
                <li
                  key={ch}
                  className={`sidebar-item channel-item ${isActive ? 'active' : ''}`}
                  onClick={() => switchChannel(ch)}
                >
                  <div className="item-left">
                    <BsHash className="channel-icon" />
                    <span className="item-name">{ch}</span>
                  </div>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Direct Messages */}
        <div className="sidebar-group dm-group">
          <div className="group-header">
            <span className="group-label">Direct Messages</span>
            <span className="user-count-badge">{allRegisteredUsers.length}</span>
          </div>
          <ul className="sidebar-items-list">
            {allRegisteredUsers.map((u) => {
              const isActive = isDirectMessage && activeDmUser === u.username;
              const status = onlineUsersMap[u.username] || 'offline';
              const unread = unreadCounts[u.username] || 0;

              return (
                <li
                  key={u._id}
                  className={`sidebar-item dm-item ${isActive ? 'active' : ''}`}
                  onClick={() => startDirectMessage(u.username)}
                >
                  <div className="item-left">
                    <div className="dm-avatar-wrap">
                      <img
                        src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${u.username}`}
                        alt="avatar"
                        className="sidebar-avatar"
                      />
                      <span className={`status-dot-mini ${status}`} />
                    </div>
                    <span className="item-name">{u.username}</span>
                  </div>
                  {unread > 0 && <span className="unread-badge">{unread}</span>}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sidebar Footer User Profile */}
        <div className="sidebar-footer-profile">
          <div className="profile-left" onClick={() => setShowStatusMenu((prev) => !prev)}>
            <div className="footer-avatar-wrap">
              <img
                src={myAvatar}
                alt="avatar"
                className="footer-avatar"
              />
              <span className={`status-dot-mini ${myStatus}`} />
            </div>
            <div className="footer-user-details">
              <span className="footer-username">{user?.fullName || username}</span>
              <span className="footer-status-label">{myStatus}</span>
            </div>
          </div>

          <button
            type="button"
            className="footer-profile-gear-btn"
            onClick={() => navigate('/profile')}
            title="Edit Profile & Bio"
          >
            <BsPerson />
          </button>

          {showStatusMenu && (
            <div className="status-dropdown-menu">
              <div className="status-menu-header">Set Your Presence</div>
              <button
                className={`status-option ${myStatus === 'online' ? 'selected' : ''}`}
                onClick={() => handleStatusChange('online')}
              >
                <span className="status-dot online" /> Online / Available
              </button>
              <button
                className={`status-option ${myStatus === 'away' ? 'selected' : ''}`}
                onClick={() => handleStatusChange('away')}
              >
                <span className="status-dot away" /> Away (BRB)
              </button>
              <button
                className={`status-option ${myStatus === 'busy' ? 'selected' : ''}`}
                onClick={() => handleStatusChange('busy')}
              >
                <span className="status-dot busy" /> Busy (Do Not Disturb)
              </button>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <button
                type="button"
                className="status-option"
                onClick={() => navigate('/profile')}
              >
                <BsPerson /> Edit Profile & Bio
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Conversation Area */}
      <main className="chat-main">
        {/* Header Bar */}
        {rateLimitToast && (
          <div className="rate-limit-toast">
            <span>⚠️ {rateLimitToast}</span>
          </div>
        )}
        <header className="chat-header-bar">
          <div className="header-left">
            <button
              type="button"
              className="mobile-sidebar-toggle-btn"
              onClick={() => setMobileSidebarOpen((prev) => !prev)}
              title="Toggle Channels & DMs"
            >
              <BsList />
            </button>
            {isDirectMessage ? (
              <div className="dm-header-info">
                <div className="dm-header-avatar-wrap">
                  <img
                    src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${activeDmUser}`}
                    alt="avatar"
                    className="dm-header-avatar"
                  />
                  <span className={`status-dot ${activeDmStatus}`} />
                </div>
                <div>
                  <h3 className="room-title">@{activeDmUser}</h3>
                  <span className="room-subtitle">
                    Direct Message • Status: <strong className="status-highlight">{activeDmStatus}</strong>
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="room-title">
                  <span className="room-symbol">#</span> {room}
                </h3>
                <span className="room-subtitle">Public Channel</span>
              </div>
            )}
          </div>

          <div className="header-right">
            {/* Direct Message Video & Voice Call Actions */}
            {isDirectMessage && (
              <div className="dm-call-actions">
                <button
                  type="button"
                  className="dm-call-btn video-call"
                  onClick={() => startCall('video')}
                  title={`Start Video Call with @${activeDmUser}`}
                >
                  <BsCameraVideoFill />
                  <span className="call-btn-text">Video Call</span>
                </button>
                <button
                  type="button"
                  className="dm-call-btn voice-call"
                  onClick={() => startCall('audio')}
                  title={`Start Voice Call with @${activeDmUser}`}
                >
                  <BsTelephoneFill />
                  <span className="call-btn-text">Voice Call</span>
                </button>
              </div>
            )}
            {/* Search Bar Toggle */}
            <div className={`header-search-box ${showSearch ? 'expanded' : ''}`}>
              <button
                type="button"
                className="search-toggle-btn"
                onClick={() => setShowSearch((v) => !v)}
                title="Search messages"
              >
                <BsSearch />
              </button>
              {showSearch && (
                <div className="search-input-wrap">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                    >
                      <BsX />
                    </button>
                  )}
                  {searchQuery && (
                    <span className="search-matches-count">
                      {displayedHistory.length} match{displayedHistory.length !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Actions (Hidden on Mobile) */}
            <div className="desktop-actions-group">
              {/* Audio Toggle */}
              <button
                onClick={toggleSound}
                className={`sound-toggle-btn ${soundEnabled ? 'active' : 'muted'}`}
                title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
              >
                {soundEnabled ? <BsVolumeUpFill /> : <BsVolumeMuteFill />}
                <span className="sound-label">{soundEnabled ? 'Sound On' : 'Muted'}</span>
              </button>

              {/* Account Profile */}
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="header-profile-btn"
                title="View & Edit Profile"
              >
                <img
                  src={myAvatar}
                  alt="profile"
                  className="header-profile-avatar"
                />
                <span className="profile-btn-label">Profile</span>
              </button>

              {/* Logout */}
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>

            {/* Mobile 3-Dots Kebab Menu (Sound, Profile & Logout on click) */}
            <div className="mobile-menu-wrap">
              <button
                type="button"
                className="mobile-menu-btn"
                onClick={() => setShowMobileMoreMenu((prev) => !prev)}
                title="More actions"
              >
                <BsThreeDotsVertical />
              </button>

              {showMobileMoreMenu && (
                <div className="mobile-more-dropdown">
                  <button
                    type="button"
                    className="mobile-dropdown-item"
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      navigate('/profile');
                    }}
                  >
                    <BsPerson />
                    <span>My Account Profile</span>
                  </button>

                  <button
                    type="button"
                    className="mobile-dropdown-item"
                    onClick={() => {
                      toggleSound();
                      setShowMobileMoreMenu(false);
                    }}
                  >
                    {soundEnabled ? <BsVolumeUpFill /> : <BsVolumeMuteFill />}
                    <span>{soundEnabled ? 'Sound Effects (On)' : 'Sound Effects (Muted)'}</span>
                  </button>

                  <div className="mobile-dropdown-divider" />

                  <button
                    type="button"
                    className="mobile-dropdown-item logout"
                    onClick={() => {
                      setShowMobileMoreMenu(false);
                      handleLogout();
                    }}
                  >
                    <BsTrash />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Pinned Announcement Banner */}
        {pinnedMessage && (
          <div className="pinned-message-banner">
            <div className="pinned-banner-left" onClick={() => scrollToMessage(pinnedMessage._id)}>
              <BsPinFill className="pinned-icon" />
              <div className="pinned-content-preview">
                <span className="pinned-author">Pinned Announcement by @{pinnedMessage.author}</span>
                <span className="pinned-text">
                  {pinnedMessage.message || (pinnedMessage.attachment ? 'Attachment: ' + pinnedMessage.attachment.name : 'Voice Note')}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="pinned-unpin-btn"
              onClick={() => handleTogglePin(pinnedMessage._id)}
              title="Unpin message"
            >
              <BsX />
            </button>
          </div>
        )}

        {/* Messages Body with Grouping & Date Dividers */}
        <div
          className="chat-messages-container"
          ref={chatBodyRef}
          onScroll={handleChatScroll}
        >
          {/* Load Earlier Messages Button */}
          {hasMore && !searchQuery && (
            <div className="load-more-container">
              <button
                type="button"
                className="load-more-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                <BsArrowUpCircle />
                <span>{isLoadingMore ? 'Loading older history...' : 'Load earlier messages'}</span>
              </button>
            </div>
          )}

          {displayedHistory.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-icon">
                {searchQuery ? <BsSearch /> : isDirectMessage ? <BsChatDotsFill /> : '💬'}
              </div>
              <h4>
                {searchQuery
                  ? 'No messages found'
                  : isDirectMessage
                  ? `Direct conversation with @${activeDmUser}`
                  : `Welcome to #${room}!`}
              </h4>
              <p>
                {searchQuery
                  ? `No messages match "${searchQuery}". Try another keyword.`
                  : isDirectMessage
                  ? `This is the start of your direct messages with ${activeDmUser}.`
                  : `This is the start of the #${room} channel. Say hello to everyone!`}
              </p>
            </div>
          ) : (
            displayedHistory.map((msg, index) => {
              const prevMsg = index > 0 ? displayedHistory[index - 1] : null;

              // Check if date divider is needed
              const showDateDivider =
                !prevMsg ||
                new Date(msg.timestamp).toDateString() !==
                  new Date(prevMsg.timestamp).toDateString();
              const dateDividerLabel = showDateDivider ? formatDividerDate(msg.timestamp) : '';

              // Check if message is grouped with previous message
              const isGrouped = !showDateDivider && isSameSenderWithin3Min(msg, prevMsg);

              const reactionsMap = groupReactions(msg.reactions);
              const isHovered = hoveredMsgId === (msg._id || index);

              return (
                <React.Fragment key={msg._id || index}>
                  {/* Floating Date Divider */}
                  {showDateDivider && (
                    <div className="date-separator-divider">
                      <span className="date-separator-label">{dateDividerLabel}</span>
                    </div>
                  )}

                  {(() => {
                    const isFromMe = Boolean(
                      msg.fromMe === true ||
                      (msg.senderId && user?._id && String(msg.senderId) === String(user._id)) ||
                      (msg.senderId && user?.id && String(msg.senderId) === String(user.id)) ||
                      (msg.author && username && msg.author.trim().toLowerCase() === username.trim().toLowerCase())
                    );
                    return (
                      <div
                        id={`msg_${msg._id || index}`}
                        className={`message-wrapper ${isFromMe ? 'outgoing' : 'incoming'} ${
                          isGrouped ? 'grouped' : ''
                        }`}
                        onMouseEnter={() => setHoveredMsgId(msg._id || index)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        <div className="message-container">
                          {/* Show Author name only if incoming & NOT grouped */}
                          {!isFromMe && !isGrouped && (
                            <span className="message-author">
                            {msg.author}
                            {msg.isPinned && <span className="pinned-badge-chip">📌 Pinned</span>}
                          </span>
                          )}

                      <div
                        className={`message-bubble ${msg.isDeleted ? 'deleted' : ''} ${
                          isGrouped ? 'grouped-bubble' : ''
                        }`}
                      >
                        {/* Floating Quick Action Bar */}
                        {isHovered && !msg.isDeleted && (
                          <div className="message-actions-bar">
                            <div className="quick-emojis">
                              {QUICK_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="quick-emoji-btn"
                                  onClick={() => handleToggleReaction(msg._id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="action-icon-btn reply-btn"
                              title="Reply to message"
                              onClick={() =>
                                setReplyingTo({
                                  id: msg._id,
                                  author: msg.author,
                                  text: msg.message || (msg.attachment ? '📎 ' + msg.attachment.name : '')
                                })
                              }
                            >
                              <BsReplyFill />
                            </button>
                            {isFromMe && (
                              <button
                                type="button"
                                className="action-icon-btn delete-msg-btn"
                                title="Delete for everyone"
                                onClick={() => handleDeleteMessage(msg._id)}
                              >
                                <BsTrash />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Quoted Reply */}
                        {msg.replyTo && !msg.isDeleted && (
                          <div
                            className="quoted-reply-box"
                            onClick={() => scrollToQuotedMessage(msg.replyTo.messageId)}
                          >
                            <span className="quote-author">@{msg.replyTo.author}</span>
                            <span className="quote-text">{msg.replyTo.text}</span>
                          </div>
                        )}

                        {/* Attachment Content */}
                        {msg.attachment && !msg.isDeleted && (
                          <div className="attachment-content-wrap">
                            {msg.attachment.type === 'image' ? (
                              <img
                                src={msg.attachment.url}
                                alt={msg.attachment.name}
                                className="attached-image-preview"
                                onClick={() => setPreviewImageModal(msg.attachment.url)}
                                title="Click to view full size"
                              />
                            ) : msg.attachment.type === 'audio' ? (
                              <AudioWaveformPlayer
                                src={msg.attachment.url}
                                duration={msg.attachment.duration}
                                fromMe={isFromMe}
                              />
                            ) : (
                              <a
                                href={msg.attachment.url}
                                download={msg.attachment.name}
                                className="attached-file-card"
                              >
                                <BsFileEarmarkTextFill className="file-icon" />
                                <div className="file-meta">
                                  <span className="file-name">{msg.attachment.name}</span>
                                  <span className="file-size">{formatFileSize(msg.attachment.size)}</span>
                                </div>
                                <BsDownload className="file-dl-icon" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.message && (
                          <p className="message-text">
                            {msg.isDeleted ? (
                              <span className="deleted-text">
                                🚫 <em>This message was deleted</em>
                              </span>
                            ) : (
                              msg.message
                            )}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="message-meta-info">
                          <span className="meta-time">{msg.time}</span>
                          {isFromMe && !msg.isDeleted && (
                            <span className="delivery-status" title="Delivered">
                              <BsCheck2All className="check-icon delivered" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Reactions Pill Display */}
                      {!msg.isDeleted && Object.keys(reactionsMap).length > 0 && (
                        <div className="reactions-row">
                          {Object.entries(reactionsMap).map(([emoji, data]) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`reaction-pill ${data.hasReacted ? 'user-reacted' : ''}`}
                              title={`Reacted by: ${data.users.join(', ')}`}
                              onClick={() => handleToggleReaction(msg._id, emoji)}
                            >
                              <span className="pill-emoji">{emoji}</span>
                              <span className="pill-count">{data.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                      </div>
                    );
                  })()}
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Typing Bar */}
        <div className="typing-indicator-bar">
          {typingUsers.length > 0 && (
            <div className="typing-content">
              <span className="typing-dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </span>
              <span className="typing-text">
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}
        </div>

        {/* Replying-To Banner */}
        {replyingTo && (
          <div className="replying-banner">
            <div className="replying-details">
              <span className="reply-label">Replying to <strong>@{replyingTo.author}</strong>:</span>
              <span className="reply-preview-snippet">{replyingTo.text}</span>
            </div>
            <button
              type="button"
              className="cancel-reply-btn"
              onClick={() => setReplyingTo(null)}
              title="Cancel reply"
            >
              <BsX />
            </button>
          </div>
        )}

        {/* Staged File Banner */}
        {stagedFile && (
          <div className="attachment-staging-banner">
            <div className="staging-details">
              {stagedFile.type === 'image' ? (
                <img
                  src={stagedFile.previewUrl}
                  alt="staging"
                  className="staging-thumb"
                />
              ) : (
                <BsFileEarmarkTextFill className="staging-file-icon" />
              )}
              <div className="staging-info">
                <span className="staging-filename">{stagedFile.name}</span>
                <span className="staging-size">{formatFileSize(stagedFile.size)}</span>
              </div>
            </div>
            {isUploading ? (
              <span className="uploading-indicator">
                <BsCloudArrowUpFill className="upload-spin-icon" /> Uploading to CDN...
              </span>
            ) : (
              <button
                type="button"
                className="cancel-staging-btn"
                onClick={() => setStagedFile(null)}
                title="Remove attachment"
              >
                <BsX />
              </button>
            )}
          </div>
        )}

        {/* Message Input Footer */}
        <footer className="chat-footer-bar">
          {isRecordingVoice ? (
            <VoiceRecorder
              onSendAudio={handleSendVoiceNote}
              onCancel={() => setIsRecordingVoice(false)}
            />
          ) : (
            <>
          <button
            type="button"
            className="attachment-trigger-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Attach image or file"
          >
            <BsPaperclip />
          </button>

          <div className="emoji-trigger-wrap">
            <button
              type="button"
              className="emoji-toggle-btn"
              onClick={() => setShowPicker((val) => !val)}
              title="Add emoji"
            >
              <BsEmojiSmileFill />
            </button>
            {showPicker && (
              <div className="emoji-popover">
                <Picker onEmojiClick={onEmojiClick} theme="dark" />
              </div>
            )}
          </div>

          <input
            type="text"
            className="chat-text-input"
            value={currentMessage}
            placeholder={
              isDirectMessage
                ? `Message @${activeDmUser}...`
                : `Message #${room}...`
            }
            onChange={handleTyping}
            onKeyDown={(e) => e.key === 'Enter' && !isUploading && sendMessage()}
            disabled={isUploading}
          />

          <button
            type="button"
            className="action-btn mic-btn"
            onClick={() => setIsRecordingVoice(true)}
            title="Record Voice Note"
          >
            <BsMicFill />
          </button>

          <button
            type="button"
            className="send-message-btn"
            onClick={sendMessage}
            disabled={(!currentMessage.trim() && !stagedFile) || isUploading}
            title="Send Message"
          >
            <IoSend />
          </button>
          </>
          )}
        </footer>
      </main>

      {/* WebRTC Incoming Call Ringing Dialog */}
      {incomingCall && (
        <IncomingCallDialog
          incomingCall={incomingCall}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {/* WebRTC Active Call Stage Overlay */}
      {callState.isActive && (
        <CallModal
          callState={callState}
          socket={socket}
          onEndCall={endCall}
        />
      )}
    </div>
  );
}

export default ChatPage;
