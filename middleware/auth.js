const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const authenticateToken = async (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Verify user still exists in database
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] },
      raw: true
    });
    if (!user) return null;
    
    return {
      id: user.id.toString(),
      username: user.username,
      role: user.role
    };
  } catch (error) {
    return null;
  }
};

module.exports = { authenticateToken };
