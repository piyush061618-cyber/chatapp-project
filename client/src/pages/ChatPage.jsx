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
  BsCircleFill,
  BsHash
} from 'react-icons/bs';
import { MdVerified } from 'react-icons/md';
import { IoSend } from 'react-icons/io5';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import socket from '../socket';
import './ChatPage.css';

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

function ChatPage() {
  const [room, setRoom] = useState('general');
  const [activeDmUser, setActiveDmUser] = useState(null); // null if in a group channel
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
  const [myStatus, setMyStatus] = useState('online'); // 'online' | 'away' | 'busy'
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('chat_sound_enabled') !== 'false';
  });

  const chatBodyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // Decode username from token
  const getUsernameFromToken = () => {
    try {
      if (!token) return 'Guest';
      return JSON.parse(atob(token.split('.')[1])).username;
    } catch (e) {
      return 'Guest';
    }
  };
  const username = getUsernameFromToken();

  // Active target room name
  const activeRoomName = activeDmUser ? getDmRoom(username, activeDmUser) : room;

  // Toggle sound
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('chat_sound_enabled', String(next));
      return next;
    });
  };

  // Status changer
  const handleStatusChange = (status) => {
    setMyStatus(status);
    setShowStatusMenu(false);
    if (socket) {
      socket.emit('status_change', { status });
    }
  };

  // Fetch rooms and registered users
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsRes, usersRes] = await Promise.all([
          axios.get('http://localhost:3001/api/rooms'),
          axios.get('http://localhost:3001/api/auth/users')
        ]);
        const customRooms = (roomsRes.data || []).filter((r) => !r.startsWith('dm__') && !r.startsWith('user_'));
        if (!customRooms.includes('general')) customRooms.unshift('general');
        setAvailableRooms(customRooms);
        setAllRegisteredUsers((usersRes.data || []).filter((u) => u.username !== username));
      } catch (err) {
        console.error('Failed to load rooms or users:', err);
      }
    };
    fetchData();
  }, [username]);

  // Scroll to bottom on message
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory, typingUsers]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !showChat) return;

    socket.connect();

    // Global online users listener
    const handleGlobalUsers = (usersList) => {
      const map = {};
      usersList.forEach((u) => {
        map[u.username] = u.status || 'online';
      });
      setOnlineUsersMap(map);
    };
    socket.on('global_users_update', handleGlobalUsers);

    // Incoming message
    const handleReceiveMessage = (data) => {
      const isCurrentConversation =
        data.room === (activeDmUser ? getDmRoom(username, activeDmUser) : room);

      if (isCurrentConversation) {
        setChatHistory((list) => {
          if (data._id && list.some((m) => m._id === data._id)) return list;
          return [...list, { ...data, fromMe: data.author === username }];
        });
      } else {
        // Message is for another room or DM! Increment unread badge
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

    // Load History
    const handleLoadHistory = (history) => {
      const formatted = history.map((msg) => ({
        ...msg,
        fromMe: msg.author === username
      }));
      setChatHistory(formatted);
    };

    // Typing
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

    // Delete
    const handleMessageDeleted = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, message: 'This message was deleted', reactions: [] }
            : msg
        )
      );
      if (soundEnabled) sounds.playDelete();
    };

    // Reaction
    const handleReactionUpdated = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId ? { ...msg, reactions: data.reactions } : msg
        )
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('load_history', handleLoadHistory);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);

    return () => {
      socket.off('global_users_update', handleGlobalUsers);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('load_history', handleLoadHistory);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
    };
  }, [socket, showChat, username, activeDmUser, room, soundEnabled]);

  // Join or switch room/channel
  const switchChannel = (targetChannel) => {
    setActiveDmUser(null);
    setRoom(targetChannel);
    setChatHistory([]);
    setUnreadCounts((prev) => ({ ...prev, [targetChannel]: 0 }));
    socket.emit('join_room', { room: targetChannel });
    setShowChat(true);
  };

  // Start or switch to 1-on-1 DM
  const startDirectMessage = (targetUser) => {
    setActiveDmUser(targetUser);
    setChatHistory([]);
    setUnreadCounts((prev) => ({ ...prev, [targetUser]: 0 }));
    const dmRoom = getDmRoom(username, targetUser);
    socket.emit('join_room', { room: dmRoom });
    setShowChat(true);
  };

  // Send message
  const sendMessage = () => {
    if (currentMessage.trim() !== '') {
      const targetRoom = activeRoomName;
      const tempId = 'temp_' + Date.now();
      const messageData = {
        room: targetRoom,
        message: currentMessage.trim()
      };

      if (soundEnabled) sounds.playSend();

      const localMsg = {
        _id: tempId,
        room: targetRoom,
        message: currentMessage.trim(),
        author: username,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      socket.emit('stop_typing', { room: targetRoom });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  // Typing
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

  // Delete message
  const handleDeleteMessage = (msgId) => {
    if (!msgId) return;
    if (window.confirm('Delete this message for everyone?')) {
      socket.emit('delete_message', { messageId: msgId, room: activeRoomName });
    }
  };

  // Reactions
  const handleToggleReaction = (msgId, emoji) => {
    if (!msgId || !emoji) return;
    socket.emit('add_reaction', { messageId: msgId, room: activeRoomName, emoji });
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

  // Join Room Splash View
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
            <p className="join-subtitle">Connect with friends, channels, and 1-on-1 direct messages</p>
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
                <p className="no-rooms-hint">No other registered users yet. Invite a friend!</p>
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

  // Active Chat Layout (Channels + DMs)
  const isDirectMessage = Boolean(activeDmUser);
  const activeDmStatus = activeDmUser ? (onlineUsersMap[activeDmUser] || 'offline') : null;

  return (
    <div className="chat-layout">
      {/* Sidebar with Channels + Direct Messages */}
      <aside className="chat-sidebar">
        <div className="sidebar-brand">
          <div className="brand-dot" />
          <h3>PulseChat</h3>
        </div>

        {/* Public Channels List */}
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

        {/* Direct Messages List */}
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

        {/* User Mini Profile in Sidebar Footer */}
        <div className="sidebar-footer-profile">
          <div className="profile-left" onClick={() => setShowStatusMenu((prev) => !prev)}>
            <div className="footer-avatar-wrap">
              <img
                src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${username}`}
                alt="avatar"
                className="footer-avatar"
              />
              <span className={`status-dot-mini ${myStatus}`} />
            </div>
            <div className="footer-user-details">
              <span className="footer-username">{username}</span>
              <span className="footer-status-label">{myStatus}</span>
            </div>
          </div>

          {/* Status Popup */}
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
            </div>
          )}
        </div>
      </aside>

      {/* Main Conversation Window */}
      <main className="chat-main">
        {/* Header Bar */}
        <header className="chat-header-bar">
          <div className="header-left">
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
            {/* Audio Toggle */}
            <button
              onClick={toggleSound}
              className={`sound-toggle-btn ${soundEnabled ? 'active' : 'muted'}`}
              title={soundEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            >
              {soundEnabled ? <BsVolumeUpFill /> : <BsVolumeMuteFill />}
              <span className="sound-label">{soundEnabled ? 'Sound On' : 'Muted'}</span>
            </button>

            {/* Logout */}
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </header>

        {/* Messages Body */}
        <div className="chat-messages-container" ref={chatBodyRef}>
          {chatHistory.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-icon">
                {isDirectMessage ? <BsChatDotsFill /> : '💬'}
              </div>
              <h4>
                {isDirectMessage
                  ? `Direct conversation with @${activeDmUser}`
                  : `Welcome to #${room}!`}
              </h4>
              <p>
                {isDirectMessage
                  ? `This is the start of your encrypted 1-on-1 direct message history with ${activeDmUser}.`
                  : `This is the start of the #${room} channel. Say hello to everyone!`}
              </p>
            </div>
          ) : (
            chatHistory.map((msg, index) => {
              const reactionsMap = groupReactions(msg.reactions);
              const isHovered = hoveredMsgId === (msg._id || index);

              return (
                <div
                  key={msg._id || index}
                  className={`message-wrapper ${msg.fromMe ? 'outgoing' : 'incoming'}`}
                  onMouseEnter={() => setHoveredMsgId(msg._id || index)}
                  onMouseLeave={() => setHoveredMsgId(null)}
                >
                  <div className="message-container">
                    {!msg.fromMe && (
                      <span className="message-author">{msg.author}</span>
                    )}

                    <div className={`message-bubble ${msg.isDeleted ? 'deleted' : ''}`}>
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
                          {msg.fromMe && (
                            <button
                              type="button"
                              className="delete-msg-btn"
                              title="Delete for everyone"
                              onClick={() => handleDeleteMessage(msg._id)}
                            >
                              <BsTrash />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Content */}
                      <p className="message-text">
                        {msg.isDeleted ? (
                          <span className="deleted-text">
                            🚫 <em>This message was deleted</em>
                          </span>
                        ) : (
                          msg.message
                        )}
                      </p>

                      {/* Meta */}
                      <div className="message-meta-info">
                        <span className="meta-time">{msg.time}</span>
                        {msg.fromMe && !msg.isDeleted && (
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

        {/* Message Input Footer */}
        <footer className="chat-footer-bar">
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
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />

          <button
            type="button"
            className="send-message-btn"
            onClick={sendMessage}
            disabled={!currentMessage.trim()}
            title="Send Message"
          >
            <IoSend />
          </button>
        </footer>
      </main>
    </div>
  );
}

export default ChatPage;
