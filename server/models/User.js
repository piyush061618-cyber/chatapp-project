const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  fullName: {
    type: String,
    default: '',
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    default: '',
    maxlength: 250,
  },
  avatar: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
