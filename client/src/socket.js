// client/src/socket.js

import { io } from 'socket.io-client';

const SERVER_URL = "http://localhost:3001";

// Create a socket instance, but don't connect automatically
const socket = io(SERVER_URL, {
  autoConnect: false, // We will connect manually
  // This 'auth' object sends the token to the server's middleware
  auth: (cb) => {
    cb({
      token: localStorage.getItem('token'),
    });
  },
});

export default socket;