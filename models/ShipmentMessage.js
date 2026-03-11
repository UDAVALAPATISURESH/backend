const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ShipmentMessage = sequelize.define('ShipmentMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  senderName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'shipment_messages',
  updatedAt: false,
  indexes: [
    { fields: ['shipmentId'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ShipmentMessage;

