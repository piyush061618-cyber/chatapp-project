require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const socketAuthMiddleware = require('./middleware/authMiddleware');
const Message = require('./models/Message');
const User = require('./models/User');

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));

const server = http.createServer(app);

// Phase 7: Aggressive TCP Heartbeats & Keep-Alive for ghost socket detection
const io = new Server(server, {
  pingTimeout: 7000,   // Drop dead socket if no pong in 7 seconds
  pingInterval: 3000,  // Send ping every 3 seconds
  maxHttpBufferSize: 2e7, // 20MB buffer
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Phase 7: Token Bucket Rate Limiter (Anti-Spam)
class TokenBucketLimiter {
  constructor(capacity = 5, fillPerSec = 2) {
    this.capacity = capacity;
    this.fillPerSec = fillPerSec;
    this.buckets = new Map();
  }
  consume(userId) {
    const now = Date.now();
    let bucket = this.buckets.get(userId);
    if (!bucket) {
      bucket = { tokens: this.capacity, lastTime: now };
      this.buckets.set(userId, bucket);
    }
    const elapsedSec = (now - bucket.lastTime) / 1000;
    bucket.tokens = Math.min(this.capacity, bucket.tokens + elapsedSec * this.fillPerSec);
    bucket.lastTime = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }
}
const rateLimiter = new TokenBucketLimiter(5, 2);

// Phase 7: Idempotency Cache (Deduplication)
const processedMessageIds = new Map();
setInterval(() => {
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [id, item] of processedMessageIds.entries()) {
    if (item.timestamp < cutoff) processedMessageIds.delete(id);
  }
}, 60 * 1000);

// State stores
const roomUsers = {};
const onlineUsers = new Map();

const roomsRouter = require('./routes/rooms')(io);
app.use('/api/rooms', roomsRouter);

// Apply authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  const username = socket.user.username;
  console.log(`⚡ User Connected: ${username} (${socket.id})`);

  onlineUsers.set(username, {
    id: socket.user.id,
    username: username,
    status: 'online',
    socketId: socket.id
  });

  socket.join(`user_${username}`);
  io.emit('global_users_update', Array.from(onlineUsers.values()));

  // 1. Join Room
  socket.on('join_room', async (data) => {
    const { room } = data;
    if (!room) return;

    if (socket.currentRoom && socket.currentRoom !== room) {
      socket.leave(socket.currentRoom);
      if (roomUsers[socket.currentRoom]) {
        roomUsers[socket.currentRoom] = roomUsers[socket.currentRoom].filter(
          (u) => u.username !== username
        );
        io.in(socket.currentRoom).emit('update_user_list', roomUsers[socket.currentRoom]);
      }
    }

    socket.join(room);
    socket.currentRoom = room;
    console.log(`[JOIN] User ${username} joined room: ${room}`);

    if (!roomUsers[room]) {
      roomUsers[room] = [];
    }

    const currentStatus = onlineUsers.get(username)?.status || 'online';
    if (!roomUsers[room].some((u) => u.username === username)) {
      roomUsers[room].push({ id: socket.id, username, status: currentStatus });
    }

    io.in(room).emit('update_user_list', roomUsers[room]);

    try {
      const history = await Message.find({ room })
        .sort({ timestamp: -1 })
        .limit(30)
        .populate('sender', 'username')
        .lean();

      const formattedHistory = history.map((msg) => ({
        _id: msg._id.toString(),
        room: msg.room,
        message: msg.isDeleted ? 'This message was deleted' : msg.message,
        isDeleted: msg.isDeleted || false,
        isPinned: msg.isPinned || false,
        clientMessageId: msg.clientMessageId || null,
        reactions: msg.reactions || [],
        attachment: msg.isDeleted ? null : msg.attachment,
        replyTo: msg.replyTo || null,
        author: msg.sender ? msg.sender.username : 'Unknown',
        senderId: msg.sender ? msg.sender._id.toString() : null,
        timestamp: msg.timestamp,
        time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })).reverse();

      socket.emit('load_history', {
        room,
        history: formattedHistory,
        hasMore: history.length === 30
      });
    } catch (err) {
      console.error('Error fetching message history:', err);
    }
  });

  // 2. Load More Messages (Pagination)
  socket.on('load_more_messages', async (data) => {
    const { room, beforeTimestamp } = data;
    if (!room || !beforeTimestamp) return;

    try {
      const history = await Message.find({
        room,
        timestamp: { $lt: new Date(beforeTimestamp) }
      })
        .sort({ timestamp: -1 })
        .limit(30)
        .populate('sender', 'username')
        .lean();

      const formatted = history.map((msg) => ({
        _id: msg._id.toString(),
        room: msg.room,
        message: msg.isDeleted ? 'This message was deleted' : msg.message,
        isDeleted: msg.isDeleted || false,
        clientMessageId: msg.clientMessageId || null,
        reactions: msg.reactions || [],
        attachment: msg.isDeleted ? null : msg.attachment,
        replyTo: msg.replyTo || null,
        author: msg.sender ? msg.sender.username : 'Unknown',
        senderId: msg.sender ? msg.sender._id.toString() : null,
        timestamp: msg.timestamp,
        time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })).reverse();

      socket.emit('more_messages_loaded', {
        room,
        messages: formatted,
        hasMore: history.length === 30
      });
    } catch (err) {
      console.error('Error loading more messages:', err);
    }
  });

  // 3. Status Change
  socket.on('status_change', (data) => {
    const { status } = data;
    if (['online', 'away', 'busy'].includes(status)) {
      const userObj = onlineUsers.get(username);
      if (userObj) {
        userObj.status = status;
        io.emit('global_users_update', Array.from(onlineUsers.values()));
      }
    }
  });

  // 4. Send Message (with Token Bucket Rate Limiter & Idempotency Key)
  socket.on('send_message', async (data, callback) => {
    const { room, message, attachment, replyTo, clientMessageId } = data;
    if (!room) return;
    if ((!message || !message.trim()) && !attachment) return;

    // Rate Limiting Check
    if (!rateLimiter.consume(socket.user.id)) {
      const rateLimitMsg = 'You are sending messages too fast! Please slow down.';
      socket.emit('rate_limit_exceeded', { message: rateLimitMsg });
      if (typeof callback === 'function') {
        callback({ status: 'rate_limited', error: rateLimitMsg });
      }
      return;
    }

    // Idempotency Deduplication Check
    if (clientMessageId && processedMessageIds.has(clientMessageId)) {
      const cached = processedMessageIds.get(clientMessageId).messageData;
      if (typeof callback === 'function') {
        callback({ status: 'ok', message: cached, deduplicated: true });
      }
      return;
    }

    try {
      const newMessage = new Message({
        room,
        message: (message || '').trim(),
        sender: socket.user.id,
        clientMessageId: clientMessageId || null,
        attachment: attachment || null,
        replyTo: replyTo || null,
        isDeleted: false,
        isPinned: false,
        reactions: []
      });
      await newMessage.save();

      const messageData = {
        _id: newMessage._id.toString(),
        room,
        message: newMessage.message,
        author: username,
        senderId: socket.user.id,
        clientMessageId: newMessage.clientMessageId,
        attachment: newMessage.attachment,
        replyTo: newMessage.replyTo,
        isDeleted: false,
        isPinned: false,
        reactions: [],
        timestamp: newMessage.timestamp,
        time: new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Store in idempotency cache
      if (clientMessageId) {
        processedMessageIds.set(clientMessageId, {
          messageData,
          timestamp: Date.now()
        });
      }

      socket.to(room).emit('receive_message', messageData);

      if (room.startsWith('dm__')) {
        const parts = room.replace('dm__', '').split('__');
        if (parts.length === 2) {
          const recipient = parts[0] === username ? parts[1] : parts[0];
          socket.to(`user_${recipient}`).emit('receive_message', messageData);
        }
      }

      if (typeof callback === 'function') {
        callback({ status: 'ok', message: messageData });
      } else {
        socket.emit('message_sent_confirm', messageData);
      }
    } catch (err) {
      console.error('Error saving or sending message:', err);
      if (typeof callback === 'function') {
        callback({ status: 'error', error: err.message });
      }
    }
  });

  // 5. Delete Message
  socket.on('delete_message', async (data) => {
    const { messageId, room } = data;
    if (!messageId || !room) return;

    try {
      const targetMessage = await Message.findById(messageId);
      if (!targetMessage) return;

      if (targetMessage.sender.toString() !== socket.user.id) {
        return socket.emit('error_action', { message: 'You can only delete your own messages' });
      }

      targetMessage.isDeleted = true;
      targetMessage.message = 'This message was deleted';
      targetMessage.attachment = null;
      targetMessage.reactions = [];
      await targetMessage.save();

      io.in(room).emit('message_deleted', {
        messageId: targetMessage._id.toString(),
        room
      });

      if (room.startsWith('dm__')) {
        const parts = room.replace('dm__', '').split('__');
        if (parts.length === 2) {
          const recipient = parts[0] === username ? parts[1] : parts[0];
          socket.to(`user_${recipient}`).emit('message_deleted', {
            messageId: targetMessage._id.toString(),
            room
          });
        }
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  });

  // 6. Add Reaction
  socket.on('add_reaction', async (data) => {
    const { messageId, room, emoji } = data;
    if (!messageId || !room || !emoji) return;

    try {
      const targetMessage = await Message.findById(messageId);
      if (!targetMessage || targetMessage.isDeleted) return;

      if (!targetMessage.reactions) {
        targetMessage.reactions = [];
      }

      const existingIndex = targetMessage.reactions.findIndex(
        (r) => r.username === username && r.emoji === emoji
      );

      if (existingIndex > -1) {
        targetMessage.reactions.splice(existingIndex, 1);
      } else {
        targetMessage.reactions = targetMessage.reactions.filter(
          (r) => r.username !== username
        );
        targetMessage.reactions.push({
          emoji,
          username,
          userId: socket.user.id
        });
      }

      await targetMessage.save();

      io.in(room).emit('reaction_updated', {
        messageId: targetMessage._id.toString(),
        room,
        reactions: targetMessage.reactions
      });

      if (room.startsWith('dm__')) {
        const parts = room.replace('dm__', '').split('__');
        if (parts.length === 2) {
          const recipient = parts[0] === username ? parts[1] : parts[0];
          socket.to(`user_${recipient}`).emit('reaction_updated', {
            messageId: targetMessage._id.toString(),
            room,
            reactions: targetMessage.reactions
          });
        }
      }
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  });

  // 7. Typing
  socket.on('typing', (data) => {
    socket.to(data.room).emit('user_typing', username);
    if (data.room.startsWith('dm__')) {
      const parts = data.room.replace('dm__', '').split('__');
      if (parts.length === 2) {
        const recipient = parts[0] === username ? parts[1] : parts[0];
        socket.to(`user_${recipient}`).emit('user_typing', username);
      }
    }
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.room).emit('user_stopped_typing', username);
    if (data.room.startsWith('dm__')) {
      const parts = data.room.replace('dm__', '').split('__');
      if (parts.length === 2) {
        const recipient = parts[0] === username ? parts[1] : parts[0];
        socket.to(`user_${recipient}`).emit('user_stopped_typing', username);
      }
    }
  });


  // 7. Pin / Unpin Message
  socket.on('pin_message', async (data) => {
    const { messageId, room } = data;
    if (!messageId || !room) return;

    try {
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return;
      }

      const msg = await Message.findById(messageId).populate('sender', 'username');
      if (!msg) return;

      msg.isPinned = !msg.isPinned;
      await msg.save();

      const pinnedPayload = {
        messageId: msg._id.toString(),
        isPinned: msg.isPinned,
        message: {
          _id: msg._id.toString(),
          message: msg.isDeleted ? 'This message was deleted' : msg.message,
          author: msg.sender ? msg.sender.username : username,
          attachment: msg.attachment,
          isPinned: msg.isPinned,
          room: msg.room,
          timestamp: msg.timestamp
        }
      };

      io.in(room).emit('message_pinned', pinnedPayload);

      if (room.startsWith('dm__')) {
        const parts = room.replace('dm__', '').split('__');
        if (parts.length === 2) {
          const recipient = parts[0] === username ? parts[1] : parts[0];
          socket.to(`user_${recipient}`).emit('message_pinned', pinnedPayload);
        }
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  });

  // WebRTC 1-on-1 Video & Audio Signaling
  socket.on('call_user', (data) => {
    const { userToCall, signalData, callType } = data;
    if (!userToCall) return;

    io.to(`user_${userToCall}`).emit('call_incoming', {
      signal: signalData,
      from: username,
      callType: callType || 'video',
      callerAvatar: socket.user.avatar || '',
      callerFullName: socket.user.fullName || username
    });
  });

  socket.on('answer_call', (data) => {
    const { to, signal } = data;
    if (!to) return;

    io.to(`user_${to}`).emit('call_accepted', {
      signal,
      from: username
    });
  });

  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    if (!to) return;

    io.to(`user_${to}`).emit('ice_candidate', {
      candidate,
      from: username
    });
  });

  socket.on('end_call', (data) => {
    const { to } = data;
    if (to) {
      io.to(`user_${to}`).emit('call_ended', { from: username });
    }
  });

  // 8. Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`🔌 User Disconnected: ${username} (${socket.id}) - Reason: ${reason}`);
    onlineUsers.delete(username);
    io.emit('global_users_update', Array.from(onlineUsers.values()));

    const currentRoom = socket.currentRoom;
    if (currentRoom && roomUsers[currentRoom]) {
      roomUsers[currentRoom] = roomUsers[currentRoom].filter((u) => u.username !== username);
      io.in(currentRoom).emit('update_user_list', roomUsers[currentRoom]);
      io.in(currentRoom).emit('user_stopped_typing', username);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 SERVER IS RUNNING ON PORT ${PORT}`);
});
