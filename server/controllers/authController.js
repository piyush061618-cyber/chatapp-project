const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), msg: errors.array()[0]?.msg || 'Validation failed' });
  }

  const { username, password, fullName, bio, avatar } = req.body;

  try {
    const cleanUsername = (username || '').trim();
    let user = await User.findOne({ username: cleanUsername });
    if (user) {
      return res.status(400).json({ msg: 'User already exists with this username' });
    }

    user = new User({
      username: cleanUsername,
      password,
      fullName: (fullName || cleanUsername).trim(),
      bio: (bio || '').trim(),
      avatar: (avatar || '').trim(),
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();

    const payload = { user: { id: user.id, username: user.username } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          bio: user.bio,
          avatar: user.avatar,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Server error during registration' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array(), msg: 'Username and password required' });
  }

  const { username, password } = req.body;

  try {
    const cleanUsername = (username || '').trim();
    let user = await User.findOne({ username: cleanUsername });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }

    const payload = { user: { id: user.id, username: user.username } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName || user.username,
          bio: user.bio || '',
          avatar: user.avatar || '',
          createdAt: user.createdAt,
        },
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error during login' });
  }
};

// GET current authenticated user profile
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('getMe error:', err.message);
    res.status(500).json({ msg: 'Server error fetching user profile' });
  }
};

// PUT update profile details (rename, bio, avatar, fullName)
exports.updateProfile = async (req, res) => {
  try {
    const { username, fullName, bio, avatar } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if new username is requested and already taken
    if (username && username.trim().toLowerCase() !== user.username.toLowerCase()) {
      const cleanUsername = username.trim();
      const existing = await User.findOne({
        username: new RegExp('^' + cleanUsername + '$', 'i'),
        _id: { $ne: user._id },
      });
      if (existing) {
        return res.status(400).json({ msg: 'Username is already taken. Please choose another.' });
      }
      user.username = cleanUsername;
    }

    if (fullName !== undefined) user.fullName = fullName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar.trim();

    await user.save();

    // Re-issue JWT with updated username
    const payload = { user: { id: user.id, username: user.username } };
    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      msg: 'Profile updated successfully!',
      token: newToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('updateProfile error:', err.message);
    res.status(500).json({ msg: 'Server error updating profile' });
  }
};
