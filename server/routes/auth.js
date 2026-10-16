const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');
const User = require('../models/User');

// @route   POST api/auth/register
// @desc    Register user
router.post(
  '/register',
  [
    check('username', 'Username is required').not().isEmpty(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 }),
  ],
  authController.register
);

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post(
  '/login',
  [
    check('username', 'Username is required').exists(),
    check('password', 'Password is required').exists(),
  ],
  authController.login
);

// @route   GET api/auth/me
// @desc    Get current user profile
router.get('/me', authMiddleware, authController.getMe);

// @route   PUT api/auth/profile
// @desc    Update current user profile (rename, bio, avatar, fullName)
router.put('/profile', authMiddleware, authController.updateProfile);

// @route   GET api/auth/users
// @desc    Get all registered users (excluding passwords)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('username fullName bio avatar _id createdAt');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error fetching users' });
  }
});

// @route   GET api/auth/user/:username
// @desc    Get public profile for a specific username
router.get('/user/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('username fullName bio avatar _id createdAt');
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ error: 'Server error fetching user profile' });
  }
});

module.exports = router;
