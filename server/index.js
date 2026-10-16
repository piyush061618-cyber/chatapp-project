require('dotenv').config();
const express = require('express');
const http = require('http');
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
app.use(express.json());

// API Routes
app.use('/api/auth', require('./routes/auth'));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

const roomUsers = {};
const roomsRouter = require('./routes/rooms')(io);
app.use('/api/rooms', roomsRouter);

// Apply authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`⚡ User Connected: ${socket.user.username} (${socket.id})`);

  // Join Room
  socket.on('join_room', async (data) => {
    const { room } = data;
    if (!room) return;

    socket.join(room);
    socket.room = room;
    console.log(`[JOIN] User ${socket.user.username} joined room: ${room}`);

    if (!roomUsers[room]) {
      roomUsers[room] = [];
    }

    if (!roomUsers[room].some(user => user.id === socket.id)) {
      roomUsers[room].push({ id: socket.id, username: socket.user.username });
    }

    io.in(room).emit('update_user_list', roomUsers[room]);

    // Load message history
    try {
      const history = await Message.find({ room })
        .sort({ timestamp: 1 })
        .limit(100)
        .populate('sender', 'username');

      const formattedHistory = history.map(msg => ({
        _id: msg._id.toString(),
        room: msg.room,
        message: msg.isDeleted ? 'This message was deleted' : msg.message,
        isDeleted: msg.isDeleted || false,
        reactions: msg.reactions || [],
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

  // Send Message
  socket.on('send_message', async (data, callback) => {
    const { room, message } = data;
    if (!room || !message || !message.trim()) return;

    try {
      const newMessage = new Message({
        room,
        message: message.trim(),
        sender: socket.user.id,
        isDeleted: false,
        reactions: []
      });
      await newMessage.save();

      const messageData = {
        _id: newMessage._id.toString(),
        room,
        message: newMessage.message,
        author: socket.user.username,
        senderId: socket.user.id,
        isDeleted: false,
        reactions: [],
        timestamp: newMessage.timestamp,
        time: new Date(newMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      // Broadcast to other clients
      socket.to(room).emit('receive_message', messageData);

      // Acknowledge back to sender
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

  // Delete Message (Delete for everyone)
  socket.on('delete_message', async (data) => {
    const { messageId, room } = data;
    if (!messageId || !room) return;

    try {
      const targetMessage = await Message.findById(messageId);
      if (!targetMessage) return;

      // Only author can delete
      if (targetMessage.sender.toString() !== socket.user.id) {
        return socket.emit('error_action', { message: 'You can only delete your own messages' });
      }

      targetMessage.isDeleted = true;
      targetMessage.message = 'This message was deleted';
      targetMessage.reactions = [];
      await targetMessage.save();

      io.in(room).emit('message_deleted', {
        messageId: targetMessage._id.toString(),
        room
      });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  });

  // Add / Toggle Reaction
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
        r => r.username === socket.user.username && r.emoji === emoji
      );

      if (existingIndex > -1) {
        targetMessage.reactions.splice(existingIndex, 1);
      } else {
        targetMessage.reactions = targetMessage.reactions.filter(
          r => r.username !== socket.user.username
        );
        targetMessage.reactions.push({
          emoji,
          username: socket.user.username,
          userId: socket.user.id
        });
      }

      await targetMessage.save();

      io.in(room).emit('reaction_updated', {
        messageId: targetMessage._id.toString(),
        room,
        reactions: targetMessage.reactions
      });
    } catch (err) {
      console.error('Error updating reaction:', err);
    }
  });

  // Typing
  socket.on('typing', (data) => {
    socket.to(data.room).emit('user_typing', socket.user.username);
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.room).emit('user_stopped_typing', socket.user.username);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 User Disconnected: ${socket.user.username} (${socket.id})`);
    const { room } = socket;
    if (room && roomUsers[room]) {
      roomUsers[room] = roomUsers[room].filter((user) => user.id !== socket.id);
      io.in(room).emit('update_user_list', roomUsers[room]);
      io.in(room).emit('user_stopped_typing', socket.user.username);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 SERVER IS RUNNING ON PORT ${PORT}`);
});
