const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { PubSub } = require('graphql-subscriptions');
const User = require('./models/User');
const Shipment = require('./models/Shipment');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const pubsub = new PubSub();

// Define event constants
const SHIPMENT_ADDED = 'SHIPMENT_ADDED';
const SHIPMENT_UPDATED = 'SHIPMENT_UPDATED';
const SHIPMENT_DELETED = 'SHIPMENT_DELETED';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id.toString(), username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '7h' }
  );
};

const resolvers = {
  Query: {
    shipments: async (parent, { page = 1, limit = 10, filter, sort }, { user }) => {
      if (!user) throw new Error('Authentication required');

      try {
        // Build where clause
        const where = {};

        // Apply filters
        if (filter) {
          if (filter.status) {
            where.status = filter.status;
          }
          if (filter.carrier) {
            where.carrier = { [Op.like]: `%${filter.carrier}%` };
          }
          if (filter.origin) {
            where.origin = { [Op.like]: `%${filter.origin}%` };
          }
          if (filter.destination) {
            where.destination = { [Op.like]: `%${filter.destination}%` };
          }
          if (filter.search) {
            where[Op.or] = [
              { trackingNumber: { [Op.like]: `%${filter.search}%` } },
              { customerName: { [Op.like]: `%${filter.search}%` } },
              { origin: { [Op.like]: `%${filter.search}%` } },
              { destination: { [Op.like]: `%${filter.search}%` } }
            ];
          }
        }

        // Build order
        const order = [];
        if (sort && sort.field) {
          order.push([sort.field, sort.order === 'ASC' ? 'ASC' : 'DESC']);
        } else {
          order.push(['createdAt', 'DESC']);
        }

        // Get total count
        const totalCount = await Shipment.count({ where });

        // Calculate pagination
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(totalCount / limit);

        // Fetch shipments
        const shipments = await Shipment.findAll({
          where,
          order,
          limit,
          offset,
          raw: true
        });

        // Convert to GraphQL format
        const formattedShipments = shipments.map(shipment => ({
          id: shipment.id.toString(),
          trackingNumber: shipment.trackingNumber,
          origin: shipment.origin,
          destination: shipment.destination,
          status: shipment.status,
          carrier: shipment.carrier,
          weight: parseFloat(shipment.weight),
          dimensions: shipment.dimensions,
          estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString() : null,
          actualDelivery: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString() : null,
          customerName: shipment.customerName,
          customerEmail: shipment.customerEmail,
          creatorEmail: shipment.creatorEmail || null,
          createdAt: new Date(shipment.createdAt).toISOString(),
          updatedAt: new Date(shipment.updatedAt).toISOString()
        }));

        return {
          shipments: formattedShipments,
          totalCount,
          pageInfo: {
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        };
      } catch (error) {
        console.error('Error fetching shipments:', error);
        throw new Error('Failed to fetch shipments');
      }
    },

    shipment: async (parent, { id }, { user }) => {
      if (!user) throw new Error('Authentication required');

      try {
        const shipment = await Shipment.findByPk(id, { raw: true });
        if (!shipment) return null;

        return {
          id: shipment.id.toString(),
          trackingNumber: shipment.trackingNumber,
          origin: shipment.origin,
          destination: shipment.destination,
          status: shipment.status,
          carrier: shipment.carrier,
          weight: parseFloat(shipment.weight),
          dimensions: shipment.dimensions,
          estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString() : null,
          actualDelivery: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString() : null,
          customerName: shipment.customerName,
          customerEmail: shipment.customerEmail,
          creatorEmail: shipment.creatorEmail || null,
          createdAt: new Date(shipment.createdAt).toISOString(),
          updatedAt: new Date(shipment.updatedAt).toISOString()
        };
      } catch (error) {
        console.error('Error fetching shipment:', error);
        throw new Error('Failed to fetch shipment');
      }
    },

    me: async (parent, args, { user }) => {
      if (!user) return null;

      try {
        const userData = await User.findByPk(user.id, {
          attributes: { exclude: ['password'] },
          raw: true
        });
        if (!userData) return null;

        return {
          id: userData.id.toString(),
          username: userData.username,
          email: userData.email,
          role: userData.role,
          scopes: userData.scopes || []
        };
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },

    users: async (parent, args, { user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

      try {
        const users = await User.findAll({
          attributes: { exclude: ['password'] },
          raw: true
        });
        return users.map(u => ({
          id: u.id.toString(),
          username: u.username,
          email: u.email,
          role: u.role,
          scopes: u.scopes || []
        }));
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }
    }
  },

  Mutation: {
    login: async (parent, { username, email, password }) => {
      try {
        if (!password) {
          throw new Error('Password is required');
        }

        // Support login with either username or email (but prefer email)
        let user;
        const searchEmail = email ? email.trim().toLowerCase() : null;
        const searchUsername = username ? username.trim().toLowerCase() : null;
        
        if (searchEmail) {
          // Use exact match - MySQL string comparison is case-insensitive by default
          user = await User.findOne({ 
            where: { 
              email: searchEmail
            } 
          });
          if (!user) {
            throw new Error('Email not found');
          }
        } else if (searchUsername) {
          // Use exact match - MySQL string comparison is case-insensitive by default
          user = await User.findOne({ 
            where: { 
              username: searchUsername
            } 
          });
          if (!user) {
            throw new Error('Username not found');
          }
        } else {
          throw new Error('Username or email is required');
        }

        // Verify password
        if (!user.password) {
          console.error('User found but password field is missing:', user.id);
          throw new Error('Password is incorrect');
        }

        // Trim password before comparison
        const trimmedPassword = password ? password.trim() : '';
        const isValid = await user.comparePassword(trimmedPassword);
        
        if (!isValid) {
          console.error(`Password mismatch for user: ${user.email || user.username}`);
          console.error(`Password hash exists: ${user.password ? 'Yes' : 'No'}`);
          throw new Error('Password is incorrect');
        }

        const token = generateToken(user);
        return {
          token,
          user: {
            id: user.id.toString(),
            username: user.username,
            email: user.email,
            role: user.role,
            scopes: user.scopes || []
          }
        };
      } catch (error) {
        console.error('Login error:', error.message);
        // Return specific error messages for user-facing errors
        if (error.message === 'Email not found' || error.message === 'Username not found') {
          throw new Error(error.message);
        }
        if (error.message === 'Password is incorrect') {
          throw new Error(error.message);
        }
        // Generic error
        throw new Error(error.message || 'Login failed. Please try again.');
      }
    },

    register: async (parent, { username, email, password, role, scopes }, { user }) => {
      try {
        // Only admin can create users
        if (!user || user.role !== 'ADMIN') {
          throw new Error('Admin access required to create users');
        }

        // Admin has all access, no scopes needed
        const userScopes = role === 'ADMIN' ? [] : (scopes || []);

        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { username: username.toLowerCase() },
              { email: email.toLowerCase() }
            ]
          }
        });

        if (existingUser) {
          if (existingUser.username === username.toLowerCase()) {
            throw new Error('Username already exists');
          }
          if (existingUser.email === email.toLowerCase()) {
            throw new Error('Email already exists');
          }
        }

        const newUser = await User.create({
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password,
          role,
          scopes: userScopes
        });

        const token = generateToken(newUser);

        return {
          token,
          user: {
            id: newUser.id.toString(),
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            scopes: newUser.scopes || []
          }
        };
      } catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
          throw new Error('Username or email already exists');
        }
        throw new Error(error.message || 'Registration failed');
      }
    },

    addShipment: async (parent, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');

      try {
        // Check if tracking number already exists
        const existing = await Shipment.findOne({ where: { trackingNumber: input.trackingNumber } });
        if (existing) {
          throw new Error('Tracking number already exists');
        }

        // Get user email for creator tracking
        const userRecord = await User.findByPk(user.id);
        const creatorEmail = userRecord ? userRecord.email : null;

        const shipment = await Shipment.create({
          ...input,
          estimatedDelivery: new Date(input.estimatedDelivery),
          creatorEmail: creatorEmail
        });

        const formattedShipment = {
          id: shipment.id.toString(),
          trackingNumber: shipment.trackingNumber,
          origin: shipment.origin,
          destination: shipment.destination,
          status: shipment.status,
          carrier: shipment.carrier,
          weight: parseFloat(shipment.weight),
          dimensions: shipment.dimensions,
          estimatedDelivery: shipment.estimatedDelivery ? shipment.estimatedDelivery.toISOString() : null,
          actualDelivery: shipment.actualDelivery ? shipment.actualDelivery.toISOString() : null,
          customerName: shipment.customerName,
          customerEmail: shipment.customerEmail,
          creatorEmail: shipment.creatorEmail,
          createdAt: shipment.createdAt.toISOString(),
          updatedAt: shipment.updatedAt.toISOString()
        };

        pubsub.publish(SHIPMENT_ADDED, { shipmentAdded: formattedShipment });
        return formattedShipment;
      } catch (error) {
        console.error('Error adding shipment:', error);
        throw new Error(error.message || 'Failed to add shipment');
      }
    },

    updateShipment: async (parent, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');

      try {
        const updateData = { ...input };
        delete updateData.id;

        // Convert date strings to Date objects
        if (updateData.estimatedDelivery) {
          updateData.estimatedDelivery = new Date(updateData.estimatedDelivery);
        }
        if (updateData.actualDelivery) {
          updateData.actualDelivery = new Date(updateData.actualDelivery);
        }

        const [affectedRows] = await Shipment.update(updateData, {
          where: { id: input.id }
        });

        if (affectedRows === 0) {
          throw new Error('Shipment not found');
        }

        const shipment = await Shipment.findByPk(input.id, { raw: true });

        const formattedShipment = {
          id: shipment.id.toString(),
          trackingNumber: shipment.trackingNumber,
          origin: shipment.origin,
          destination: shipment.destination,
          status: shipment.status,
          carrier: shipment.carrier,
          weight: parseFloat(shipment.weight),
          dimensions: shipment.dimensions,
          estimatedDelivery: shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toISOString() : null,
          actualDelivery: shipment.actualDelivery ? new Date(shipment.actualDelivery).toISOString() : null,
          customerName: shipment.customerName,
          customerEmail: shipment.customerEmail,
          creatorEmail: shipment.creatorEmail || null,
          createdAt: new Date(shipment.createdAt).toISOString(),
          updatedAt: new Date(shipment.updatedAt).toISOString()
        };

        pubsub.publish(SHIPMENT_UPDATED, { shipmentUpdated: formattedShipment });
        return formattedShipment;
      } catch (error) {
        console.error('Error updating shipment:', error);
        throw new Error(error.message || 'Failed to update shipment');
      }
    },

    deleteShipment: async (parent, { id }, { user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

      try {
        const deletedRows = await Shipment.destroy({ where: { id } });
        if (deletedRows === 0) {
          throw new Error('Shipment not found');
        }

        pubsub.publish(SHIPMENT_DELETED, { shipmentDeleted: id });
        return true;
      } catch (error) {
        console.error('Error deleting shipment:', error);
        throw new Error(error.message || 'Failed to delete shipment');
      }
    },

    updateUser: async (parent, { input }, { user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

      try {
        const updateData = {};
        if (input.username) updateData.username = input.username.toLowerCase();
        if (input.email) updateData.email = input.email.toLowerCase();
        if (input.role) {
          updateData.role = input.role;
          // Admin has all access, no scopes needed
          if (input.role === 'ADMIN') {
            updateData.scopes = [];
          }
        }
        if (input.password) {
          // Ensure password is hashed (trim and hash if not already hashed)
          const passwordStr = String(input.password).trim();
          if (!passwordStr.startsWith('$2')) {
            // Password is not hashed, hash it now
            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(passwordStr, salt);
          } else {
            updateData.password = passwordStr;
          }
        }
        if (input.scopes !== undefined) {
          // Only set scopes for employees, admin has all access
          if (input.role === 'EMPLOYEE' || !input.role) {
            updateData.scopes = input.scopes;
          } else {
            updateData.scopes = [];
          }
        }

        const [affectedRows] = await User.update(updateData, {
          where: { id: input.id }
        });

        if (affectedRows === 0) {
          throw new Error('User not found');
        }

        const updatedUser = await User.findByPk(input.id, {
          attributes: { exclude: ['password'] },
          raw: true
        });

        return {
          id: updatedUser.id.toString(),
          username: updatedUser.username,
          email: updatedUser.email,
          role: updatedUser.role,
          scopes: updatedUser.scopes || []
        };
      } catch (error) {
        console.error('Error updating user:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
          throw new Error('Username or email already exists');
        }
        throw new Error(error.message || 'Failed to update user');
      }
    },

    deleteUser: async (parent, { id }, { user }) => {
      if (!user || user.role !== 'ADMIN') {
        throw new Error('Admin access required');
      }

      try {
        // Prevent deleting yourself
        if (user.id === id.toString()) {
          throw new Error('Cannot delete your own account');
        }

        const deletedRows = await User.destroy({ where: { id } });
        if (deletedRows === 0) {
          throw new Error('User not found');
        }
        return true;
      } catch (error) {
        console.error('Error deleting user:', error);
        throw new Error(error.message || 'Failed to delete user');
      }
    },

    changePassword: async (parent, { currentPassword, newPassword }, { user }) => {
      if (!user) {
        throw new Error('Authentication required');
      }

      try {
        // Get the full user record with password
        const userRecord = await User.findByPk(user.id);
        if (!userRecord) {
          throw new Error('User not found');
        }

        // Verify current password
        const isValid = await userRecord.comparePassword(currentPassword);
        if (!isValid) {
          throw new Error('Current password is incorrect');
        }

        // Validate new password
        if (!newPassword || newPassword.trim().length < 6) {
          throw new Error('New password must be at least 6 characters');
        }

        // Hash and update password
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);

        await User.update(
          { password: hashedPassword },
          { where: { id: user.id } }
        );

        return true;
      } catch (error) {
        console.error('Error changing password:', error);
        throw new Error(error.message || 'Failed to change password');
      }
    }
  },

  Subscription: {
    shipmentAdded: {
      subscribe: () => pubsub.asyncIterator([SHIPMENT_ADDED]),
    },
    shipmentUpdated: {
      subscribe: () => pubsub.asyncIterator([SHIPMENT_UPDATED]),
    },
    shipmentDeleted: {
      subscribe: () => pubsub.asyncIterator([SHIPMENT_DELETED]),
    },
  }
};

module.exports = resolvers;
