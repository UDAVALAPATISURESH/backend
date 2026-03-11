const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id.toString(), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7h' }
  );
};

const formatUser = (user) => {
  if (!user) return null;
  const plain = user.get ? user.get({ plain: true }) : user;
  return {
    id: plain.id.toString(),
    username: plain.username,
    email: plain.email,
    role: plain.role,
    scopes: plain.scopes || [],
    isFirstLogin: plain.isFirstLogin !== undefined ? plain.isFirstLogin : true,
    googleId: plain.googleId || null
  };
};

const login = async (email, username, password) => {
  if (!password) {
    throw new Error('Password is required');
  }

  let user;
  const searchEmail = email ? email.trim().toLowerCase() : null;
  const searchUsername = username ? username.trim().toLowerCase() : null;
  
  if (searchEmail) {
    user = await User.findOne({ where: { email: searchEmail } });
    if (!user) {
      throw new Error('Email not found');
    }
  } else if (searchUsername) {
    user = await User.findOne({ where: { username: searchUsername } });
    if (!user) {
      throw new Error('Username not found');
    }
  } else {
    throw new Error('Username or email is required');
  }

  if (!user.password) {
    throw new Error('Password is incorrect');
  }

  const trimmedPassword = password ? password.trim() : '';
  const isValid = await user.comparePassword(trimmedPassword);
  
  if (!isValid) {
    throw new Error('Password is incorrect');
  }

  const token = generateToken(user);
  return {
    token,
    user: formatUser(user)
  };
};

const getCurrentUser = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ['password'] },
    raw: true
  });
  if (!user) return null;
  return formatUser(user);
};

const canManageUsers = async (authUser) => {
  if (!authUser || !authUser.id) {
    return { allowed: false, dbUser: null };
  }

  const dbUser = await User.findByPk(authUser.id);
  if (!dbUser) {
    return { allowed: false, dbUser: null };
  }

  if (dbUser.role === 'ADMIN') {
    return { allowed: true, dbUser };
  }

  const scopes = Array.isArray(dbUser.scopes) ? dbUser.scopes : [];
  const allowed = scopes.includes('MANAGE_USERS');
  return { allowed, dbUser };
};

module.exports = {
  generateToken,
  formatUser,
  login,
  getCurrentUser,
  canManageUsers
};
