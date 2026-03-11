const express = require('express');
const router = express.Router();

const { login } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public login route
router.post('/login', login);

// Example protected route to test token
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const user = await authenticateToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    return res.json({ user });
  } catch (error) {
    console.error('Error in /me route:', error);
    return res.status(500).json({ message: 'Failed to fetch current user' });
  }
});

module.exports = router;

