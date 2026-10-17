import { io } from 'socket.io-client';

// Automatically connect to backend on deployed URL or current device hostname
const defaultHost = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const SERVER_URL = import.meta.env.VITE_BACKEND_URL || `http://${defaultHost}:3001`;

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: (cb) => {
    cb({
      token: localStorage.getItem('token'),
    });
  },
});

export default socket;
