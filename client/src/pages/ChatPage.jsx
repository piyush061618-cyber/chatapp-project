import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Picker from 'emoji-picker-react';
import { BsEmojiSmileFill, BsTrash, BsVolumeUpFill, BsVolumeMuteFill, BsCheck2All, BsCheck2 } from 'react-icons/bs';
import { MdVerified } from 'react-icons/md';
import { IoSend } from 'react-icons/io5';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import socket from '../socket';
import './ChatPage.css';

// Sound Manager using Web Audio API (zero external assets needed)
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
    } catch (e) {
      // Audio error ignored
    }
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
      playTone(659.25, 0, 0.1); // E5
      playTone(880, 0.08, 0.16); // A5
    } catch (e) {
      // Audio error ignored
    }
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
    } catch (e) {
      // Audio error ignored
    }
  }
}

const sounds = new SoundEffects();
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '🎉'];

function ChatPage() {
  const [room, setRoom] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [hoveredMsgId, setHoveredMsgId] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('chat_sound_enabled') !== 'false';
  });

  const chatBodyRef = useRef(null);
  const typingTimerRef = useRef(null);
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  // Decode username from JWT
  const getUsernameFromToken = () => {
    try {
      if (!token) return 'Guest';
      return JSON.parse(atob(token.split('.')[1])).username;
    } catch (e) {
      return 'Guest';
    }
  };
  const username = getUsernameFromToken();

  // Fetch available rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/rooms');
        setAvailableRooms(response.data || []);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };
    fetchRooms();
  }, []);

  // Toggle sound
  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('chat_sound_enabled', String(next));
      return next;
    });
  };

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory, typingUsers]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !showChat) return;

    socket.connect();

    // 1. Incoming message
    const handleReceiveMessage = (data) => {
      setChatHistory((list) => {
        // Prevent duplicate append
        if (data._id && list.some((m) => m._id === data._id)) return list;
        return [...list, { ...data, fromMe: data.author === username }];
      });
      if (soundEnabled && data.author !== username) {
        sounds.playReceive();
      }
    };

    // 2. Load History
    const handleLoadHistory = (history) => {
      const formatted = history.map((msg) => ({
        ...msg,
        fromMe: msg.author === username
      }));
      setChatHistory(formatted);
    };

    // 3. User list updates
    const handleUpdateUserList = (userList) => {
      setUsers(userList || []);
    };

    // 4. Typing indicators
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

    // 5. Message Deleted
    const handleMessageDeleted = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, message: 'This message was deleted', reactions: [] }
            : msg
        )
      );
      if (soundEnabled) {
        sounds.playDelete();
      }
    };

    // 6. Reaction Updated
    const handleReactionUpdated = (data) => {
      setChatHistory((list) =>
        list.map((msg) =>
          msg._id === data.messageId
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('load_history', handleLoadHistory);
    socket.on('update_user_list', handleUpdateUserList);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('reaction_updated', handleReactionUpdated);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('load_history', handleLoadHistory);
      socket.off('update_user_list', handleUpdateUserList);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('reaction_updated', handleReactionUpdated);
    };
  }, [socket, showChat, username, soundEnabled]);

  // Join Room
  const joinRoom = (selectedRoom) => {
    const targetRoom = selectedRoom || room;
    if (targetRoom.trim() !== '') {
      setRoom(targetRoom);
      socket.emit('join_room', { room: targetRoom });
      setShowChat(true);
    } else {
      alert('Please enter or select a room name.');
    }
  };

  // Send Message
  const sendMessage = () => {
    if (currentMessage.trim() !== '') {
      const tempId = 'temp_' + Date.now();
      const messageData = {
        room: room,
        message: currentMessage.trim()
      };

      // Play send audio chime
      if (soundEnabled) {
        sounds.playSend();
      }

      // Optimistically add to local history
      const localMsg = {
        _id: tempId,
        room: room,
        message: currentMessage.trim(),
        author: username,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fromMe: true,
        reactions: [],
        isDeleted: false
      };
      setChatHistory((list) => [...list, localMsg]);

      // Emit to server with acknowledgment callback to get the real DB _id
      socket.emit('send_message', messageData, (response) => {
        if (response && response.status === 'ok' && response.message) {
          setChatHistory((list) =>
            list.map((m) => (m._id === tempId ? { ...response.message, fromMe: true } : m))
          );
        }
      });

      setCurrentMessage('');
      socket.emit('stop_typing', { room });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  };

  // Typing Handler
  const handleTyping = (e) => {
    setCurrentMessage(e.target.value);
    if (e.target.value) {
      socket.emit('typing', { room });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit('stop_typing', { room });
      }, 2000);
    } else {
      socket.emit('stop_typing', { room });
    }
  };

  // Delete message handler
  const handleDeleteMessage = (msgId) => {
    if (!msgId) return;
    if (window.confirm('Delete this message for everyone?')) {
      socket.emit('delete_message', { messageId: msgId, room });
    }
  };

  // Reaction handler
  const handleToggleReaction = (msgId, emoji) => {
    if (!msgId || !emoji) return;
    socket.emit('add_reaction', { messageId: msgId, room, emoji });
  };

  // Group reactions helper
  const groupReactions = (reactions = []) => {
    const map = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) {
        map[r.emoji] = { count: 0, users: [], hasReacted: false };
      }
      map[r.emoji].count += 1;
      map[r.emoji].users.push(r.username);
      if (r.username === username) {
        map[r.emoji].hasReacted = true;
      }
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

  // Room Selection View
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
            <p className="join-subtitle">Enter a room name or join an active discussion</p>
          </div>

          <div className="join-input-group">
            <input
              type="text"
              placeholder="Room name (e.g. general, tech, random)..."
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              className="join-room-input"
            />
            <button onClick={() => joinRoom()} className="join-room-btn">
              Join Room →
            </button>
          </div>

          <div className="available-rooms-section">
            <div className="rooms-section-title">
              <span>Active Rooms</span>
              <span className="room-count-badge">{availableRooms.length}</span>
            </div>
            {availableRooms.length > 0 ? (
              <div className="room-chips-grid">
                {availableRooms.map((r) => (
                  <button
                    key={r}
                    onClick={() => joinRoom(r)}
                    className="room-chip"
                  >
                    <span className="room-hash">#</span>
                    <span className="room-name-text">{r}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-rooms-hint">No active rooms found. Type any room name to start one!</p>
            )}
          </div>

          <button onClick={handleLogout} className="join-logout-btn">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Active Chat Room View
  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="chat-sidebar">
        <div className="sidebar-brand">
          <div className="brand-dot" />
          <h3>PulseChat</h3>
        </div>

        <div className="sidebar-section current-room-card">
          <span className="section-label">Active Channel</span>
          <div className="channel-badge">
            <span className="channel-hash">#</span>
            <span className="channel-title">{room}</span>
          </div>
          <button onClick={() => setShowChat(false)} className="switch-room-btn">
            ⇄ Switch Room
          </button>
        </div>

        <div className="sidebar-section users-list-section">
          <div className="section-header">
            <span className="section-label">Online Users</span>
            <span className="online-count">{users.length}</span>
          </div>
          <ul className="users-list">
            {users.map((u) => (
              <li key={u.id} className="user-item">
                <div className="status-dot online" />
                <img
                  src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${u.username}`}
                  alt="avatar"
                  className="user-item-avatar"
                />
                <span className="user-item-name">
                  {u.username} {u.username === username && '(You)'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header-bar">
          <div className="header-left">
            <h3 className="room-title">
              <span className="room-symbol">#</span> {room}
            </h3>
            <span className="room-subtitle">{users.length} members online</span>
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

            {/* User Profile */}
            <div className="header-user-badge">
              <img
                src={`https://api.dicebear.com/8.x/adventurer/svg?seed=${username}`}
                alt="avatar"
                className="header-avatar"
              />
              <span className="header-username">{username}</span>
              <MdVerified className="verified-tick" />
            </div>

            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </header>

        {/* Chat Messages Body */}
        <div className="chat-messages-container" ref={chatBodyRef}>
          {chatHistory.length === 0 ? (
            <div className="empty-chat-state">
              <div className="empty-icon">💬</div>
              <h4>Welcome to #{room}!</h4>
              <p>This is the start of the #{room} channel. Say hello to everyone!</p>
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

                      {/* Meta: Time & Delivery Status */}
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

        {/* Typing Indicator Bar */}
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

        {/* Footer Input */}
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
            placeholder={`Message #${room}...`}
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
