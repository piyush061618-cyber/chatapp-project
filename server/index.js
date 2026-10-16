require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const cors = require('cors');
const connectDB = require('./config/db');
const socketAuthMiddleware = require('./middleware/authMiddleware');
const Message = require('./models/Message');
const User = require('./models/User');

// Connect to the database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Serve static uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));

const server = http.createServer(app);

const io = new Server(server, {
  maxHttpBufferSize: 2e7, // 20MB buffer
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

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

  // Track global presence
  onlineUsers.set(username, {
    id: socket.user.id,
    username: username,
    status: 'online',
    socketId: socket.id
  });

  // Join personal user notification room
  socket.join(`user_${username}`);

  // Broadcast global presence update to everyone
  io.emit('global_users_update', Array.from(onlineUsers.values()));

  // 1. Join Room / Channel / DM
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

    // Load message history
    try {
      const history = await Message.find({ room })
        .sort({ timestamp: 1 })
        .limit(100)
        .populate('sender', 'username');

      const formattedHistory = history.map((msg) => ({
        _id: msg._id.toString(),
        room: msg.room,
        message: msg.isDeleted ? 'This message was deleted' : msg.message,
        isDeleted: msg.isDeleted || false,
        reactions: msg.reactions || [],
        attachment: msg.isDeleted ? null : msg.attachment,
        replyTo: msg.replyTo || null,
        author: msg.sender ? msg.sender.username : 'Unknown',
        senderId: msg.sender ? msg.sender._id.toString() : null,
        timestamp: msg.timestamp,
        time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));

      socket.emit('load_history', formattedHistory);
    } catch (err) {
      console.error('Error fetching message history:', err);
    }
  });

  // 2. Status Change
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

  // 3. Send Message
  socket.on('send_message', async (data, callback) => {
    const { room, message, attachment, replyTo } = data;
    if (!room) return;
    if ((!message || !message.trim()) && !attachment) return;

    try {
      const newMessage = new Message({
        room,
        message: (message || '').trim(),
        sender: socket.user.id,
        attachment: attachment || null,
        replyTo: replyTo || null,
        isDeleted: false,
        reactions: []
      });
      await newMessage.save();

      const messageData = {
        _id: newMessage._id.toString(),
        room,
        message: newMessage.message,
        author: username,
        senderId: socket.user.id,
        attachment: newMessage.attachment,
        replyTo: newMessage.replyTo,
        isDeleted: false,
        reactions: [],
        timestamp: newMessage.timestamp,
        time: new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

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

  // 4. Delete Message
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

  // 5. Add / Toggle Reaction
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

  // 6. Typing Indicators
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

  // 7. Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User Disconnected: ${username} (${socket.id})`);
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
