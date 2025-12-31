const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  trackingNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  origin: {
    type: DataTypes.STRING,
    allowNull: false
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING'
  },
  carrier: {
    type: DataTypes.STRING,
    allowNull: false
  },
  weight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  dimensions: {
    type: DataTypes.STRING,
    allowNull: true
  },
  estimatedDelivery: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actualDelivery: {
    type: DataTypes.DATE,
    allowNull: true
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  creatorEmail: {
    type: DataTypes.STRING,
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'shipments',
  indexes: [
    { fields: ['trackingNumber'] },
    { fields: ['status'] },
    { fields: ['carrier'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = Shipment;
