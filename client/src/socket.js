import { io } from 'socket.io-client';

// Automatically connect to backend on whichever device/IP the app is running on
const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
const SERVER_URL = `http://${host}:3001`;

const socket = io(SERVER_URL, {
  autoConnect: false,
  auth: (cb) => {
    cb({
      token: localStorage.getItem('token'),
    });
  },
});

export default socket;
