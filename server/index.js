// // server/index.js

// const express = require('express');
// const http = require('http');
// const { Server } = require("socket.io");
// const cors = require('cors');

// const app = express();
// app.use(cors()); // Use cors middleware

// const server = http.createServer(app);

// // Initialize a new instance of socket.io by passing the http server object
// // We configure CORS to allow connections from our React client
// // server/index.js

// const io = new Server(server, {
//   cors: {
//     origin: "http://localhost:5173", // ✨ NEW, CORRECT VALUE
//     methods: ["GET", "POST"]
//   }
// });

// // This event fires when a new client connects
// io.on('connection', (socket) => {
//   console.log(`✅ User Connected: ${socket.id}`);

//   // Listen for a 'send_message' event from a client
//   socket.on('send_message', (data) => {
//     // When a message is received, broadcast it to all other clients
//     // 'socket.broadcast.emit' sends the message to everyone except the sender
//     socket.broadcast.emit('receive_message', data);
//   });

//   // This event fires when a client disconnects
//   socket.on('disconnect', () => {
//     console.log(`❌ User Disconnected: ${socket.id}`);
//   });
// });

// const PORT = 3001;
// server.listen(PORT, () => {
//   console.log(`🚀 SERVER IS RUNNING ON PORT ${PORT}`);
// });

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const connectDB = require('./config/db');
const socketAuthMiddleware = require('./middleware/authMiddleware');
const Message = require('./models/Message');
const User = require('./models/User'); // Ensure User model is imported

// Connect to the database
connectDB();

const app = express();

// Middleware
app.use(cors()); // Use cors for Express API routes
app.use(express.json()); // To parse JSON request bodies

// API Routes
app.use('/api/auth', require('./routes/auth'));
// app.use('/api/upload', require('./routes/upload'));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "http://localhost:5173"], // Your frontend URL(s)
    methods: ["GET", "POST"]
  }
});

const roomUsers = {}; // In-memory store for users in each room
const roomsRouter = require('./routes/rooms')(io); 
app.use('/api/rooms', roomsRouter);

// Apply the authentication middleware to Socket.IO
io.use(socketAuthMiddleware);

// Main connection handler
io.on('connection', (socket) => {
  // socket.user is now available from the auth middleware
  console.log(`✅ User Connected: ${socket.user.username} (${socket.id})`);

  // Event: User joins a room
  socket.on('join_room', async (data) => {
    const { room } = data;
      // THIS IS THE MOST IMPORTANT LOG TO ADD
  console.log(`[JOIN ATTEMPT] User: '${socket.user.username}' is joining Room: '${room}'`);

    socket.join(room);
    console.log(`[JOIN] User ${socket.user.username} joined room: ${room}`);

    socket.room = room; // Store room info on the socket

    // Initialize the user list for the room if it's the first user
    if (!roomUsers[room]) {
      roomUsers[room] = [];
    }
    
    // Add the new user to the room's list (preventing duplicates)
    if (!roomUsers[room].some(user => user.id === socket.id)) {
      roomUsers[room].push({ id: socket.id, username: socket.user.username });
    }

    // Broadcast the updated user list to everyone in the room
    io.in(room).emit('update_user_list', roomUsers[room]);

    // Load message history for the room
    try {
      const history = await Message.find({ room })
        .sort({ timestamp: 1 })
        .limit(50)
        .populate('sender', 'username'); // Replaces sender ID with the user object (only username field)
      
      // Send history only to the user who just joined
      socket.emit('load_history', history);
    } catch (err) {
      console.error('Error fetching message history:', err);
    }
  });

  // Event: A message is sent
  socket.on('send_message', async (data) => {
     console.log('[MESSAGE RECEIVED ON SERVER]', data); // <-- ADD THIS LINE
      console.log(`[STEP 2: SERVER RECEIVED] from user '${socket.user.username}'`, data); 
    const { room, message } = data;
    try {
      const messageData = {
        room,
        message,
        author: socket.user.username, // From middleware
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      // Save message to the database
      const newMessage = new Message({ room, message, sender: socket.user.id });
      await newMessage.save();
        console.log(`[BROADCASTING MESSAGE] to room "${room}"`); // <-- ADD THIS LINE

      // Broadcast the message to everyone else in the room
      socket.to(room).emit('receive_message', messageData);
    } catch (err) {
      console.error('Error saving or sending message:', err);
    }
  });

  // Event: User is typing
  socket.on('typing', (data) => {
    socket.to(data.room).emit('user_typing', socket.user.username);
  });

  // Event: User stopped typing
  socket.on('stop_typing', (data) => {
    socket.to(data.room).emit('user_stopped_typing', socket.user.username);
  });

  // Event: User disconnects
  socket.on('disconnect', () => {
    console.log(`❌ User Disconnected: ${socket.user.username} (${socket.id})`);
    
    const { room } = socket;
    if (room && roomUsers[room]) {
      // Remove the user from the room's list
      roomUsers[room] = roomUsers[room].filter((user) => user.id !== socket.id);
      
      // Broadcast the updated user list to the remaining users
      io.in(room).emit('update_user_list', roomUsers[room]);
      // Also notify that the user stopped typing, in case they were
      io.in(room).emit('user_stopped_typing', socket.user.username);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 SERVER IS RUNNING ON PORT ${PORT}`);
});