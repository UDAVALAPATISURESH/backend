const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'Suresh478y657tdu3hl';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id.toString(), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7h' }
  );
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, username, password } = req.body || {};

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    let user;
    const searchEmail = email ? String(email).trim().toLowerCase() : null;
    const searchUsername = username ? String(username).trim().toLowerCase() : null;

    if (searchEmail) {
      user = await User.findOne({ where: { email: searchEmail } });
      if (!user) {
        return res.status(404).json({ message: 'Email not found' });
      }
    } else if (searchUsername) {
      user = await User.findOne({ where: { username: searchUsername } });
      if (!user) {
        return res.status(404).json({ message: 'Username not found' });
      }
    } else {
      return res.status(400).json({ message: 'Username or email is required' });
    }

    if (!user.password) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    const trimmedPassword = password ? String(password).trim() : '';
    const isValid = await user.comparePassword(trimmedPassword);

    if (!isValid) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    const token = generateToken(user);
    return res.json({
      token,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        scopes: user.scopes || [],
      },
    });
  } catch (error) {
    if (error.message.includes("Unknown column 'username'")) {
      console.error('❌ Database schema error: username column missing!');
      console.error('💡 Run: npm run fix-username');
      return res.status(500).json({ message: 'Database configuration error. Please contact administrator.' });
    }

    console.error('Login error:', error);
    return res.status(500).json({ message: error.message || 'Login failed. Please try again.' });
  }
};

// Middleware-style helper to check admin role for REST routes
exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

