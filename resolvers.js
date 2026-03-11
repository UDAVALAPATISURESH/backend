const { Op } = require('sequelize');
const { PubSub } = require('graphql-subscriptions');
const User = require('./models/User');
const Shipment = require('./models/Shipment');
const ShipmentMessage = require('./models/ShipmentMessage');
const ShipmentLocationHistory = require('./models/ShipmentLocationHistory');

// Services
const authService = require('./services/authService');
const otpService = require('./services/otpService');
const { formatShipment } = require('./services/shipmentFormatter');

const pubsub = new PubSub();

// Allowed scopes that can be assigned to employees via admin
const ALLOWED_EMPLOYEE_SCOPES = [
  'VIEW_SHIPMENTS',
  'CREATE_SHIPMENTS',
  'EDIT_SHIPMENTS',
  'DELETE_SHIPMENTS',
  'VIEW_ANALYTICS',
  'VIEW_REPORTS',
  'MANAGE_USERS',
];

// Define event constants
const SHIPMENT_ADDED = 'SHIPMENT_ADDED';
const SHIPMENT_UPDATED = 'SHIPMENT_UPDATED';
const SHIPMENT_DELETED = 'SHIPMENT_DELETED';
const SHIPMENT_LOCATION_UPDATED = 'SHIPMENT_LOCATION_UPDATED';
const SHIPMENT_MESSAGE_ADDED = 'SHIPMENT_MESSAGE_ADDED';

const resolvers = {
  Query: {
    shipments: async (parent, { page = 1, limit = 10, filter, sort }, { user }) => {
      if (!user) throw new Error('Authentication required');

      try {
        const where = {};
        if (filter) {
          if (filter.status) where.status = filter.status;
          if (filter.carrier) where.carrier = { [Op.like]: `%${filter.carrier}%` };
          if (filter.origin) where.origin = { [Op.like]: `%${filter.origin}%` };
          if (filter.destination) where.destination = { [Op.like]: `%${filter.destination}%` };
          if (filter.search) {
            where[Op.or] = [
              { trackingNumber: { [Op.like]: `%${filter.search}%` } },
              { customerName: { [Op.like]: `%${filter.search}%` } },
              { customerEmail: { [Op.like]: `%${filter.search}%` } }
            ];
          }
        }

        const order = [];
        if (sort && sort.field) {
          order.push([sort.field, sort.order || 'ASC']);
        } else {
          order.push(['createdAt', 'DESC']);
        }

        const totalCount = await Shipment.count({ where });
        const offset = (page - 1) * limit;
        const totalPages = Math.ceil(totalCount / limit);

        const shipments = await Shipment.findAll({
          where,
          order,
          limit,
          offset,
          raw: true
        });

        const formattedShipments = shipments.map(formatShipment);

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
        return formatShipment(shipment);
      } catch (error) {
        console.error('Error fetching shipment:', error);
        throw new Error('Failed to fetch shipment');
      }
    },

    me: async (parent, args, { user }) => {
      if (!user) return null;
      try {
        return await authService.getCurrentUser(user.id);
      } catch (error) {
        console.error('Error fetching user:', error);
        return null;
      }
    },

    users: async (parent, args, { user }) => {
      const { allowed } = await authService.canManageUsers(user);
      if (!allowed) {
        throw new Error('Admin access required');
      }
      try {
        const users = await User.findAll({
          attributes: { exclude: ['password'] },
          raw: true
        });
        return users.map(authService.formatUser);
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }
    },

    shipmentMessages: async (parent, { shipmentId }, { user }) => {
      if (!user) throw new Error('Authentication required');
      try {
        const messages = await ShipmentMessage.findAll({
          where: { shipmentId },
          order: [['createdAt', 'ASC']],
          raw: true,
        });
        return messages.map((m) => ({
          id: m.id.toString(),
          shipmentId: m.shipmentId.toString(),
          senderId: m.senderId.toString(),
          senderName: m.senderName,
          message: m.message,
          createdAt: new Date(m.createdAt).toISOString(),
        }));
      } catch (error) {
        console.error('Error fetching shipment messages:', error);
        throw new Error('Failed to fetch messages');
      }
    },

    shipmentLocationHistory: async (parent, { shipmentId }, { user }) => {
      if (!user) throw new Error('Authentication required');
      try {
        const history = await ShipmentLocationHistory.findAll({
          where: { shipmentId },
          order: [['createdAt', 'ASC']],
          raw: true
        });
        return history.map((h) => ({
          id: h.id.toString(),
          shipmentId: h.shipmentId.toString(),
          location: h.location || null,
          latitude: h.latitude !== null && h.latitude !== undefined ? parseFloat(h.latitude) : null,
          longitude: h.longitude !== null && h.longitude !== undefined ? parseFloat(h.longitude) : null,
          createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : null
        }));
      } catch (error) {
        console.error('Error fetching shipment location history:', error);
        throw new Error('Failed to fetch shipment location history');
      }
    },

    reverseGeocode: async (parent, { lat, lng }, { user }) => {
      if (!user) throw new Error('Authentication required');
      const geocodingService = require('./services/geocodingService');
      const result = await geocodingService.reverseGeocode(lat, lng);
      return {
        success: result.success,
        formattedAddress: result.formattedAddress || null,
        pinCode: result.pinCode || null,
        lat: result.success ? lat : null,
        lng: result.success ? lng : null,
        error: result.error || null,
      };
    },

    forwardGeocode: async (parent, { address }, { user }) => {
      if (!user) throw new Error('Authentication required');
      const geocodingService = require('./services/geocodingService');
      const result = await geocodingService.forwardGeocode(address);
      return {
        success: result.success,
        formattedAddress: result.formattedAddress || null,
        pinCode: result.pinCode || null,
        lat: result.lat || null,
        lng: result.lng || null,
        error: result.error || null,
      };
    },

    geocodePinCode: async (parent, { pinCode }, { user }) => {
      if (!user) throw new Error('Authentication required');
      const geocodingService = require('./services/geocodingService');
      const result = await geocodingService.geocodePinCode(pinCode);
      return {
        success: result.success,
        formattedAddress: result.formattedAddress || null,
        pinCode: result.pinCode || null,
        lat: result.lat || null,
        lng: result.lng || null,
        error: result.error || null,
      };
    },
  },

  Mutation: {
    login: async (parent, { username, email, password }) => {
      try {
        return await authService.login(email, username, password);
      } catch (error) {
        if (error.message.includes("Unknown column 'username'")) {
          console.error('❌ Database schema error: username column missing!');
          throw new Error('Database configuration error. Please contact administrator.');
        }
        if (!error.message.includes('not found') && !error.message.includes('incorrect')) {
          console.error('Login error:', error.message);
        }
        throw error;
      }
    },

    register: async (parent, { username, email, password, role, scopes }, { user }) => {
      try {
        const { allowed, dbUser: creator } = await authService.canManageUsers(user);
        if (!allowed) {
          throw new Error('Admin access required to create users');
        }

        if (role === 'ADMIN' && creator.role !== 'ADMIN') {
          throw new Error('Only admin users can create other admin accounts');
        }

        let userScopes = [];
        if (role === 'ADMIN') {
          userScopes = [];
        } else {
          const requestedScopes = Array.isArray(scopes) ? scopes : [];
          userScopes = requestedScopes.filter((scope) =>
            ALLOWED_EMPLOYEE_SCOPES.includes(scope)
          );
        }

        const existingUser = await User.findOne({
          where: {
            [Op.or]: [
              { username: username.toLowerCase() },
              { email: email.toLowerCase() }
            ]
          }
        });

        if (existingUser) {
          const conflictField = existingUser.username.toLowerCase() === username.toLowerCase() 
            ? 'username' 
            : 'email';
          throw new Error(`${conflictField === 'username' ? 'Username' : 'Email'} already exists. Please use a different ${conflictField}.`);
        }

        const createdBy = creator ? (creator.email || creator.username || null) : null;

        const newUser = await User.create({
          username: username.toLowerCase(),
          email: email.toLowerCase(),
          password,
          role,
          scopes: userScopes,
          createdBy,
        });

        const token = authService.generateToken(newUser);
        return {
          token,
          user: authService.formatUser(newUser)
        };
      } catch (error) {
        console.error('Error registering user:', error);
        throw new Error(error.message || 'Registration failed');
      }
    },

    updateUser: async (parent, { input }, { user }) => {
      const { allowed } = await authService.canManageUsers(user);
      if (!allowed) {
        throw new Error('Admin access required');
      }
      try {
        const target = await User.findByPk(input.id);
        if (!target) {
          throw new Error('User not found');
        }

        const updateData = {};
        if (input.username !== undefined) updateData.username = input.username.toLowerCase();
        if (input.email !== undefined) updateData.email = input.email.toLowerCase();
        if (input.password !== undefined) updateData.password = input.password;
        if (input.role !== undefined) updateData.role = input.role;
        if (input.scopes !== undefined) {
          if (input.role === 'ADMIN') {
            updateData.scopes = [];
          } else {
            const requestedScopes = Array.isArray(input.scopes) ? input.scopes : [];
            updateData.scopes = requestedScopes.filter((scope) =>
              ALLOWED_EMPLOYEE_SCOPES.includes(scope)
            );
          }
        }

        await target.update(updateData);
        return authService.formatUser(target);
      } catch (error) {
        console.error('Error updating user:', error);
        throw new Error(error.message || 'Failed to update user');
      }
    },

    deleteUser: async (parent, { id }, { user }) => {
      const { allowed, dbUser: actor } = await authService.canManageUsers(user);
      if (!allowed) {
        throw new Error('Admin access required');
      }
      try {
        const target = await User.findByPk(id);
        if (!target) {
          throw new Error('User not found');
        }
        if (target.role === 'ADMIN' && actor.role !== 'ADMIN') {
          throw new Error('Only admin users can delete ADMIN accounts');
        }
        await target.destroy();
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
        const userRecord = await User.findByPk(user.id);
        if (!userRecord) {
          throw new Error('User not found');
        }

        const isValid = await userRecord.comparePassword(currentPassword);
        if (!isValid) {
          throw new Error('Current password is incorrect');
        }

        if (!newPassword || newPassword.trim().length < 6) {
          throw new Error('New password must be at least 6 characters');
        }

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
    },

    addShipment: async (parent, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      try {
        const existing = await Shipment.findOne({ where: { trackingNumber: input.trackingNumber } });
        if (existing) {
          throw new Error('Tracking number already exists');
        }

        const userRecord = await User.findByPk(user.id);
        const creatorEmail = userRecord ? userRecord.email : null;

        const shipmentData = {
          ...input,
          estimatedDelivery: new Date(input.estimatedDelivery),
          creatorEmail: creatorEmail
        };
        
        // Only include actualDelivery if provided
        if (input.actualDelivery) {
          shipmentData.actualDelivery = new Date(input.actualDelivery);
        }
        
        const shipment = await Shipment.create(shipmentData);

        const formattedShipment = formatShipment(shipment);
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
        const [affectedRows] = await Shipment.update(
          {
            ...input,
            estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : undefined,
            actualDelivery: input.actualDelivery ? new Date(input.actualDelivery) : undefined,
          },
          { where: { id: input.id } }
        );

        if (affectedRows === 0) {
          throw new Error('Shipment not found');
        }

        const shipment = await Shipment.findByPk(input.id, { raw: true });
        const formattedShipment = formatShipment(shipment);

        pubsub.publish(SHIPMENT_UPDATED, { shipmentUpdated: formattedShipment });
        return formattedShipment;
      } catch (error) {
        console.error('Error updating shipment:', error);
        throw new Error(error.message || 'Failed to update shipment');
      }
    },

    updateShipmentLocation: async (parent, { input }, { user }) => {
      if (!user) throw new Error('Authentication required');
      try {
        const currentShipment = await Shipment.findByPk(input.id, { raw: true });
        if (!currentShipment) {
          throw new Error('Shipment not found');
        }

        const geocodingService = require('./services/geocodingService');
        let finalLocation = input.currentLocation;
        let finalPinCode = input.pinCode;

        // Heuristic fix: users often swap lat/lng while entering manually.
        // If coordinates look swapped and swapping puts them inside India bounds, auto-swap.
        const toNumberOrUndef = (v) => (v === null || v === undefined ? undefined : Number(v));
        const isFiniteNumber = (n) => typeof n === 'number' && Number.isFinite(n);
        const isInIndiaBounds = (lat, lng) =>
          isFiniteNumber(lat) &&
          isFiniteNumber(lng) &&
          lat >= 6 &&
          lat <= 37 &&
          lng >= 68 &&
          lng <= 97;

        const inLat = toNumberOrUndef(input.currentLat);
        const inLng = toNumberOrUndef(input.currentLng);
        if (isFiniteNumber(inLat) && isFiniteNumber(inLng)) {
          const originalInIndia = isInIndiaBounds(inLat, inLng);
          const swappedInIndia = isInIndiaBounds(inLng, inLat);
          if (!originalInIndia && swappedInIndia) {
            // Swap to prevent "other country" pins for Indian addresses/pincodes.
            input.currentLat = inLng;
            input.currentLng = inLat;
          }
        }

        // If coordinates are provided but location is not, use geocoding to get address
        if ((input.currentLat !== undefined && input.currentLng !== undefined) && !input.currentLocation) {
          const geoResult = await geocodingService.reverseGeocode(input.currentLat, input.currentLng);
          if (geoResult.success) {
            finalLocation = geoResult.formattedAddress;
            if (!finalPinCode && geoResult.pinCode) {
              finalPinCode = geoResult.pinCode;
            }
          }
        }
        // If location is provided but coordinates are not, use forward geocoding
        else if (input.currentLocation && (input.currentLat === undefined || input.currentLng === undefined)) {
          const geoResult = await geocodingService.forwardGeocode(input.currentLocation);
          if (geoResult.success) {
            input.currentLat = geoResult.lat;
            input.currentLng = geoResult.lng;
            if (!finalPinCode && geoResult.pinCode) {
              finalPinCode = geoResult.pinCode;
            }
          }
        }

        const updateData = {
          lastLocationUpdate: new Date(),
        };
        if (finalLocation !== undefined) updateData.currentLocation = finalLocation;
        if (input.currentLat !== undefined) updateData.currentLat = input.currentLat;
        if (input.currentLng !== undefined) updateData.currentLng = input.currentLng;
        if (finalPinCode !== undefined) updateData.pinCode = finalPinCode;
        if (input.status !== undefined) updateData.status = input.status;

        await Shipment.update(updateData, { where: { id: input.id } });

        if (finalLocation !== undefined || input.currentLat !== undefined || input.currentLng !== undefined) {
          await ShipmentLocationHistory.create({
            shipmentId: input.id,
            location: finalLocation !== undefined ? finalLocation : currentShipment.currentLocation,
            latitude: input.currentLat !== undefined ? input.currentLat : currentShipment.currentLat,
            longitude: input.currentLng !== undefined ? input.currentLng : currentShipment.currentLng
          });
        }

        const shipment = await Shipment.findByPk(input.id, { raw: true });
        const formattedShipment = formatShipment(shipment);

        pubsub.publish(SHIPMENT_UPDATED, { shipmentUpdated: formattedShipment });
        pubsub.publish(SHIPMENT_LOCATION_UPDATED, { shipmentLocationUpdated: formattedShipment });

        return formattedShipment;
      } catch (error) {
        console.error('Error updating shipment location:', error);
        throw new Error(error.message || 'Failed to update shipment location');
      }
    },

    deleteShipment: async (parent, { id }, { user }) => {
      if (!user) throw new Error('Authentication required');
      try {
        const shipment = await Shipment.findByPk(id);
        if (!shipment) {
          throw new Error('Shipment not found');
        }
        await shipment.destroy();
        pubsub.publish(SHIPMENT_DELETED, { shipmentDeleted: id });
        return true;
      } catch (error) {
        console.error('Error deleting shipment:', error);
        throw new Error(error.message || 'Failed to delete shipment');
      }
    },

    sendShipmentMessage: async (parent, { shipmentId, message }, { user }) => {
      if (!user) throw new Error('Authentication required');
      const trimmed = String(message || '').trim();
      if (!trimmed) {
        throw new Error('Message is required');
      }
      try {
        const shipment = await Shipment.findByPk(shipmentId);
        if (!shipment) {
          throw new Error('Shipment not found');
        }

        const userRecord = await User.findByPk(user.id);
        const senderName = userRecord ? (userRecord.username || userRecord.email) : 'Unknown';

        const newMessage = await ShipmentMessage.create({
          shipmentId,
          senderId: user.id,
          senderName,
          message: trimmed
        });

        const formattedMessage = {
          id: newMessage.id.toString(),
          shipmentId: newMessage.shipmentId.toString(),
          senderId: newMessage.senderId.toString(),
          senderName: newMessage.senderName,
          message: newMessage.message,
          createdAt: newMessage.createdAt ? new Date(newMessage.createdAt).toISOString() : null
        };

        pubsub.publish(`${SHIPMENT_MESSAGE_ADDED}:${shipmentId}`, { shipmentMessageAdded: formattedMessage });
        return formattedMessage;
      } catch (error) {
        console.error('Error sending message:', error);
        throw new Error(error.message || 'Failed to send message');
      }
    },

    generateQR: async (parent, { userId }, { user }) => {
      if (!user && !userId) {
        throw new Error('Authentication required');
      }
      try {
        return await otpService.generateQR(userId || user?.id);
      } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error(error.message || 'Failed to generate QR code');
      }
    },

    verifyOTP: async (parent, { userId, otp, secret }, { user }) => {
      if (!user && !userId) {
        throw new Error('Authentication required');
      }
      try {
        const targetUserId = userId || user?.id;
        if (user && user.id !== targetUserId) {
          throw new Error('Unauthorized');
        }
        // Clean OTP input (remove spaces, dashes, etc.)
        const cleanOTP = String(otp || '').replace(/\s|-/g, '');
        return await otpService.verifyOTP(targetUserId, cleanOTP, secret);
      } catch (error) {
        // Only log full error in development
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error verifying OTP:', error.message);
        }
        throw new Error(error.message || 'Failed to verify OTP');
      }
    },

    googleLogin: async (parent, { idToken }) => {
      try {
        throw new Error('Google authentication not yet implemented. Please use email/password login.');
      } catch (error) {
        console.error('Error with Google login:', error);
        throw new Error(error.message || 'Google authentication failed');
      }
    },
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
    shipmentLocationUpdated: {
      subscribe: () => pubsub.asyncIterator([SHIPMENT_LOCATION_UPDATED]),
    },
    shipmentMessageAdded: {
      subscribe: (parent, { shipmentId }) =>
        pubsub.asyncIterator([`${SHIPMENT_MESSAGE_ADDED}:${shipmentId}`]),
    },
  }
};

module.exports = resolvers;
