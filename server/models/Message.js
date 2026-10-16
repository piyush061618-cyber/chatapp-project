const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  room: { type: String, required: true },
  message: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', MessageSchema);