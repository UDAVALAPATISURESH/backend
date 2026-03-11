const { DataTypes } = require('sequelize');
const { sequelize } = require('../database/connection');

const ShipmentLocationHistory = sequelize.define('ShipmentLocationHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  shipmentId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'shipments',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'shipment_location_history',
  indexes: [
    { fields: ['shipmentId'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = ShipmentLocationHistory;
