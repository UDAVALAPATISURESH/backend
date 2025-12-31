const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../database/connection');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      notEmpty: true
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('ADMIN', 'EMPLOYEE'),
    allowNull: false,
    defaultValue: 'EMPLOYEE'
  },
  scopes: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
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
  tableName: 'users',
  hooks: {
    beforeCreate: async (user) => {
      // Ensure lowercase for username and email
      if (user.username) {
        user.username = user.username.toLowerCase().trim();
      }
      if (user.email) {
        user.email = user.email.toLowerCase().trim();
      }
      // Hash password - ensure it's a string and not already hashed
      if (user.password) {
        const passwordStr = String(user.password).trim();
        // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        if (!passwordStr.startsWith('$2')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(passwordStr, salt);
        }
      }
    },
    beforeUpdate: async (user) => {
      // Ensure lowercase for username and email
      if (user.changed('username') && user.username) {
        user.username = user.username.toLowerCase().trim();
      }
      if (user.changed('email') && user.email) {
        user.email = user.email.toLowerCase().trim();
      }
      // Hash password if changed - ensure it's not already hashed
      if (user.changed('password') && user.password) {
        const passwordStr = String(user.password).trim();
        // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
        if (!passwordStr.startsWith('$2')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(passwordStr, salt);
        }
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  if (!candidatePassword || !this.password) {
    return false;
  }
  // Ensure both are strings and trim whitespace
  const cleanCandidate = String(candidatePassword).trim();
  const cleanStored = String(this.password).trim();
  return await bcrypt.compare(cleanCandidate, cleanStored);
};

module.exports = User;
