const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authController = require('../controllers/authController');

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

module.exports = router;