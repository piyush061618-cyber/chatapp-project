const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: No token provided.'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.user.id).select('-password');
    if (!user) {
        return next(new Error('Authentication error: User not found.'));
    }
    socket.user = user; // Attach user to the socket object
    next();
  } catch (err) {
    next(new Error('Authentication error: Token is not valid.'));
  }
};

module.exports = socketAuth;