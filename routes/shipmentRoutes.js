const express = require('express');
const router = express.Router();

const {
  listShipments,
  getShipment,
  createShipment,
  updateShipment,
  deleteShipment,
} = require('../controllers/shipmentController');
const { authenticateToken } = require('../middleware/auth');

// Simple auth middleware for REST routes using existing authenticateToken helper
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    const user = await authenticateToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ message: 'Authentication check failed' });
  }
};

// Admin check for destructive operations
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// List & read
router.get('/', requireAuth, listShipments);
router.get('/:id', requireAuth, getShipment);

// Create / update / delete
router.post('/', requireAuth, createShipment);
router.put('/:id', requireAuth, updateShipment);
router.delete('/:id', requireAuth, requireAdmin, deleteShipment);

module.exports = router;

