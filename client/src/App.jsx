
// // client/src/App.jsx

// import React, { useState, useEffect, useRef } from 'react';
// import io from 'socket.io-client';
// import './App.css';

// const socket = io.connect("http://localhost:3001");

// function App() {
//   // ✨ STEP 1: Add a new state for the temporary name input
//   const [nameInput, setNameInput] = useState(""); 
  
//   // This state will now be set only when the user joins
//   const [username, setUsername] = useState(""); 
  
//   const [currentMessage, setCurrentMessage] = useState("");
//   const [chatHistory, setChatHistory] = useState([]);
//   const chatEndRef = useRef(null);

//   // ✨ STEP 2: Create a function to handle joining the chat
//   const joinChat = () => {
//     if (nameInput !== "") {
//       setUsername(nameInput); // Set the final username
//     }
//   };

//   const sendMessage = async () => {
//     if (currentMessage !== "" && username !== "") {
//       const messageData = {
//         author: username,
//         message: currentMessage,
//         time: new Date(Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
//       };

//       await socket.emit("send_message", messageData);
//       setChatHistory((list) => [...list, { ...messageData, fromMe: true }]);
//       setCurrentMessage("");
//     }
//   };

//   useEffect(() => {
//     const receiveMessageHandler = (data) => {
//       setChatHistory((list) => [...list, { ...data, fromMe: false }]);
//     };
//     socket.on("receive_message", receiveMessageHandler);
//     return () => {
//       socket.off("receive_message", receiveMessageHandler);
//     };
//   }, [socket]);
  
//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [chatHistory]);

//   return (
//     <div className="chat-window">
//       <div className="chat-header">
//         <p>Live Chat</p>
//       </div>
//       <div className="chat-body">
//         {/* This condition remains the same */}
//         {!username ? (
//           <div className="join-chat-container">
//             <h3>Join Chat</h3>
//             {/* ✨ STEP 3: Update the input to use the temporary state */}
//             <input
//               type="text"
//               placeholder="Enter your name..."
//               onChange={(event) => setNameInput(event.target.value)}
//               onKeyPress={(event) => event.key === 'Enter' && joinChat()}
//             />
//             <button onClick={joinChat}>Join Room</button>
//           </div>
//         ) : (
//           <>
//             <div className="message-container">
//               {chatHistory.map((msg, index) => (
//                 <div key={index} className={`message ${msg.fromMe ? "me" : "other"}`}>
//                   <div className="message-content">
//                     <p>{msg.message}</p>
//                   </div>
//                   <div className="message-meta">
//                     <p>{msg.time}</p>
//                     <p><strong>{msg.fromMe ? 'You' : msg.author}</strong></p>
//                   </div>
//                 </div>
//               ))}
//               <div ref={chatEndRef} />
//             </div>
//             <div className="chat-footer">
//               <input
//                 type="text"
//                 value={currentMessage}
//                 placeholder="Type a message..."
//                 // This is the corrected line
//                onChange={(event) => setCurrentMessage(event.target.value)}
//                 onKeyPress={(event) => event.key === 'Enter' && sendMessage()}
//               />
//               <button onClick={sendMessage}>&#9658;</button>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;


// import React, { useState } from 'react';
// import './App.css';
// import ChatPage from './pages/ChatPage';
// import { socket } from './socket';

// function App() {
//   const [username, setUsername] = useState('');
//   const [room, setRoom] = useState('');
//   const [showChat, setShowChat] = useState(false);

//   const joinRoom = () => {
//     if (username.trim() !== '' && room.trim() !== '') {
//       socket.emit('join_room', { username, room });
//       setShowChat(true);
//     }
//   };

//   return (
//     <div className="App">
//       {!showChat ? (
//         <div className="join-chat-container">
//           <h3>Join A Chat</h3>
//           <input
//             type="text"
//             placeholder="Your Name..."
//             value={username}
//             onChange={(event) => setUsername(event.target.value)}
//           />
//           <input
//             type="text"
//             placeholder="Room ID..."
//             value={room}
//             onChange={(event) => setRoom(event.target.value)}
//             onKeyPress={(event) => event.key === 'Enter' && joinRoom()}
//           />
//           <button onClick={joinRoom}>Join Room</button>
//         </div>
//       ) : (
//         <ChatPage username={username} room={room} />
//       )}
//     </div>
//   );
// }

// export default App;


// Excellent. Let's tackle these final, most complex features. This will transform your application from a real-time toy into a full-stack, persistent, and secure MERN (MongoDB, Express, React, Node.js) application.

// We'll handle Authentication first, as knowing who a user is is a prerequisite for saving messages on their behalf.

// 🏛️ Updated Folder Structures
// First, your backend and frontend will need a more robust structure to handle these new responsibilities.

// Backend (server/)
// server/
// ├── config/
// │   └── db.js             # MongoDB connection logic
// ├── controllers/
// │   └── authController.js   # Logic for register/login
// ├── middleware/
// │   └── authMiddleware.js   # To protect socket connections
// ├── models/
// │   ├── User.js           # Mongoose schema for users
// │   └── Message.js        # Mongoose schema for messages
// ├── routes/
// │   └── auth.js           # API endpoints for /register and /login
// ├── .env                  # Environment variables (DB URI, JWT Secret)
// ├── .gitignore            # To ignore node_modules and .env
// └── index.js              # Main server entry point
// Frontend (client/)
// client/src/
// ├── components/
// │   ├── UserList.js
// │   └── ...
// ├── context/
// │   └── AuthContext.js      # Global state for user authentication
// ├── pages/
// │   ├── ChatPage.js
// │   ├── LoginPage.js        # New login page
// │   └── RegisterPage.js     # New registration page
// ├── services/
// │   └── api.js              # Centralized API calls (axios)
// ├── App.js
// ├── index.css
// └── socket.js
// 🔐 Part 1: Authentication
// We will build a standard token-based authentication system using JSON Web Tokens (JWT).

// Workflow:

// A user registers or logs in via a standard API endpoint.

// The server validates their credentials and sends back a JWT.

// The React app stores this token.

// For all future communication (including the WebSocket connection), the client sends this token to prove its identity.

// Step 1: Backend Installation
// Navigate to your server directory and install the necessary packages.

// Bash

// cd server
// npm install mongoose bcryptjs jsonwebtoken dotenv express-validator
// mongoose: Object Data Modeler (ODM) for MongoDB.

// bcryptjs: For hashing passwords securely.

// jsonwebtoken: To create and verify JWTs.

// dotenv: To manage environment variables.

// express-validator: To validate incoming data.

// Step 2: Backend Setup
// Create the new files as defined in the folder structure above.

// server/.env (Create this file)
// IMPORTANT: This file stores secrets and should never be committed to Git. Create a .gitignore file in the server directory and add .env and node_modules/ to it.

// MONGO_URI=your_mongodb_connection_string_here
// JWT_SECRET=a_very_secret_and_long_random_string
// Get your MONGO_URI from a free MongoDB Atlas account.

// server/config/db.js
// This file handles the connection to your database.

// JavaScript

// const mongoose = require('mongoose');
// require('dotenv').config();

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log('MongoDB Connected...');
//   } catch (err) {
//     console.error(err.message);
//     process.exit(1); // Exit process with failure
//   }
// };

// module.exports = connectDB;
// server/models/User.js
// This defines the schema for your users.

// JavaScript

// const mongoose = require('mongoose');

// const UserSchema = new mongoose.Schema({
//   username: {
//     type: String,
//     required: true,
//     unique: true,
//   },
//   password: {
//     type: String,
//     required: true,
//   },
// });

// module.exports = mongoose.model('User', UserSchema);
// server/controllers/authController.js
// This file contains the core logic for registering and logging in users.

// JavaScript

// const User = require('../models/User');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const { validationResult } = require('express-validator');

// exports.register = async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }

//   const { username, password } = req.body;

//   try {
//     let user = await User.findOne({ username });
//     if (user) {
//       return res.status(400).json({ msg: 'User already exists' });
//     }

//     user = new User({ username, password });

//     const salt = await bcrypt.genSalt(10);
//     user.password = await bcrypt.hash(password, salt);

//     await user.save();

//     const payload = { user: { id: user.id } };
//     jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
//       if (err) throw err;
//       res.json({ token });
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };

// exports.login = async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(400).json({ errors: errors.array() });
//   }

//   const { username, password } = req.body;

//   try {
//     let user = await User.findOne({ username });
//     if (!user) {
//       return res.status(400).json({ msg: 'Invalid Credentials' });
//     }

//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(400).json({ msg: 'Invalid Credentials' });
//     }

//     const payload = { user: { id: user.id } };
//     jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }, (err, token) => {
//       if (err) throw err;
//       res.json({ token });
//     });
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send('Server error');
//   }
// };
// server/routes/auth.js
// This file defines the API endpoints.

// JavaScript

// const express = require('express');
// const router = express.Router();
// const { check } = require('express-validator');
// const authController = require('../controllers/authController');

// // @route   POST api/auth/register
// // @desc    Register user
// router.post(
//   '/register',
//   [
//     check('username', 'Username is required').not().isEmpty(),
//     check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
//   ],
//   authController.register
// );

// // @route   POST api/auth/login
// // @desc    Authenticate user & get token
// router.post(
//   '/login',
//   [
//     check('username', 'Username is required').exists(),
//     check('password', 'Password is required').exists(),
//   ],
//   authController.login
// );

// module.exports = router;
// server/index.js (Update this file)
// Finally, tie it all together in your main server file.

// JavaScript

// // At the top of server/index.js
// require('dotenv').config();
// const connectDB = require('./config/db');

// // Connect Database
// connectDB();

// // ... after const app = express();
// app.use(express.json()); // Middleware to parse JSON bodies

// // Define Routes
// app.use('/api/auth', require('./routes/auth'));

// // ... the rest of your io.on('connection', ...) logic
// Step 3: Frontend Installation
// Navigate to your client directory and install packages.

// Bash

// cd client
// npm install axios react-router-dom
// axios: For making API requests to your backend.

// react-router-dom: For handling different pages (Login, Register, Chat).

// Step 4: Frontend Implementation
// client/src/context/AuthContext.js
// This context will manage the user's authentication state across the entire app.

// JavaScript

// import React, { createContext, useState, useContext } from 'react';

// const AuthContext = createContext(null);

// export const useAuth = () => useContext(AuthContext);

// export const AuthProvider = ({ children }) => {
//   const [token, setToken] = useState(localStorage.getItem('token'));
  
//   const login = (newToken) => {
//     localStorage.setItem('token', newToken);
//     setToken(newToken);
//   };

//   const logout = () => {
//     localStorage.removeItem('token');
//     setToken(null);
//   };

//   const value = { token, login, logout };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };
// client/src/pages/RegisterPage.js & LoginPage.js
// These are simple form components for user interaction.

// JavaScript

// // client/src/pages/RegisterPage.js (LoginPage is very similar)
// import React, { useState } from 'react';
// import axios from 'axios';
// import { useAuth } from '../context/AuthContext';
// import { useNavigate } from 'react-router-dom';

// function RegisterPage() {
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const { login } = useAuth();
//   const navigate = useNavigate();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     try {
//       const res = await axios.post('http://localhost:3001/api/auth/register', { username, password });
//       login(res.data.token);
//       navigate('/chat');
//     } catch (err) {
//       console.error('Registration failed', err);
//     }
//   };
  
//   return (
//     <form onSubmit={handleSubmit} className="join-chat-container">
//       <h3>Register</h3>
//       <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
//       <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
//       <button type="submit">Register</button>
//     </form>
//   );
// }

// export default RegisterPage;
// Create LoginPage.js in the same way, but have it post to /api/auth/login.

// client/src/App.js (Update this file)
// Update App.js to use React Router and the Auth Context.

// import React from 'react';
// import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
// import { useAuth } from './hooks/useAuth.jsx';
// import LoginPage from './pages/LoginPage.jsx'; // Use .jsx if the file contains JSX
// import RegisterPage from './pages/RegisterPage.jsx';
// import ChatPage from './pages/ChatPage.jsx';
// import './App.css';

// // A wrapper to protect the chat route
// function ProtectedRoute({ children }) {
//   const { token } = useAuth();
//   return token ? children : <Navigate to="/login" />;
// }

// function App() {
//   return (
//     // <AuthProvider> <--- REMOVE THIS
//     <Router>
//       <div className="App">
//         <Routes>
//           <Route path="/login" element={<LoginPage />} />
//           <Route path="/register" element={<RegisterPage />} />
//           <Route 
//             path="/chat" 
//             element={
//               <ProtectedRoute>
//                 <ChatPage />
//               </ProtectedRoute>
//             } 
//           />
//           <Route path="*" element={<Navigate to="/login" />} />
//         </Routes>
//       </div>
//     </Router>
//     // </AuthProvider> <--- AND REMOVE THIS
//   );
// }

// export default App;



// import React, { useState } from 'react';
// import ChatPage from './pages/ChatPage';
// import socket from './socket'; // Assuming your socket connection is exported from socket.js
// import './App.css'; // Or your main stylesheet

// function App() {
//   const [username, setUsername] = useState('');
//   const [room, setRoom] = useState('');
//   const [showChat, setShowChat] = useState(false);

//   // This function handles the logic for joining a room
//   const joinRoom = () => {
//     // Only proceed if both username and room fields are filled
//     if (username.trim() !== '' && room.trim() !== '') {
//       // Emit a 'join_room' event to the server with the user's data
//       socket.emit('join_room', { username, room });
      
//       // Update the state to hide the join form and show the chat interface
//       setShowChat(true);
//     } else {
//       alert("Please enter a username and room name.");
//     }
//   };

//   return (
//     <div className="App">
//       {/* This is a conditional render.
//         If showChat is false, it displays the join chat container.
//         If showChat is true, it displays the ChatPage component.
//       */}
//       {!showChat ? (
//         <div className="join-chat-container">
//           <h3>Join a Chat Room</h3>
//           <input
//             type="text"
//             placeholder="Your Name..."
//             value={username}
//             onChange={(event) => setUsername(event.target.value)}
//           />
//           <input
//             type="text"
//             placeholder="Room Name..."
//             value={room}
//             onChange={(event) => setRoom(event.target.value)}
//             // Allows the user to press Enter to join, in addition to clicking the button
//             onKeyPress={(event) => {
//               if (event.key === 'Enter') {
//                 joinRoom();
//               }
//             }}
//           />
//           <button onClick={joinRoom}>Join Room</button>
//         </div>
//       ) : (
//         // This is the crucial part:
//         // We are passing the 'username' and 'room' state variables
//         // as props to the ChatPage component. This is how ChatPage
//         // knows what the current user's name is and which room they are in.
//         <ChatPage username={username} room={room} />
//       )}
//     </div>
//   );
// }

// export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import './App.css';

// This is a special component that checks if a user is logged in.
// If they are, it shows the ChatPage.
// If not, it redirects them to the login page.
function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* These routes define your pages */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* This is the protected route for the chat page */}
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            } 
          />
          
          {/* This route redirects any other URL to the login page */}
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;