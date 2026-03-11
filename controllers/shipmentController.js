const { Op } = require('sequelize');
const Shipment = require('../models/Shipment');
const User = require('../models/User');

// GET /api/shipments
exports.listShipments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      carrier,
      origin,
      destination,
      search,
      sortField,
      sortOrder,
    } = req.query;

    const where = {};

    if (status) {
      where.status = status;
    }
    if (carrier) {
      where.carrier = { [Op.like]: `%${carrier}%` };
    }
    if (origin) {
      where.origin = { [Op.like]: `%${origin}%` };
    }
    if (destination) {
      where.destination = { [Op.like]: `%${destination}%` };
    }
    if (search) {
      where[Op.or] = [
        { trackingNumber: { [Op.like]: `%${search}%` } },
        { customerName: { [Op.like]: `%${search}%` } },
        { origin: { [Op.like]: `%${search}%` } },
        { destination: { [Op.like]: `%${search}%` } },
      ];
    }

    const order = [];
    if (sortField) {
      order.push([sortField, sortOrder === 'ASC' ? 'ASC' : 'DESC']);
    } else {
      order.push(['createdAt', 'DESC']);
    }

    const numericPage = parseInt(page, 10) || 1;
    const numericLimit = parseInt(limit, 10) || 10;

    const totalCount = await Shipment.count({ where });
    const offset = (numericPage - 1) * numericLimit;
    const totalPages = Math.ceil(totalCount / numericLimit) || 1;

    const shipments = await Shipment.findAll({
      where,
      order,
      limit: numericLimit,
      offset,
      raw: true,
    });

    const formattedShipments = shipments.map((shipment) => ({
      id: shipment.id.toString(),
      trackingNumber: shipment.trackingNumber,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      carrier: shipment.carrier,
      weight: parseFloat(shipment.weight),
      dimensions: shipment.dimensions,
      estimatedDelivery: shipment.estimatedDelivery
        ? new Date(shipment.estimatedDelivery).toISOString()
        : null,
      actualDelivery: shipment.actualDelivery
        ? new Date(shipment.actualDelivery).toISOString()
        : null,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      creatorEmail: shipment.creatorEmail || null,
      createdAt: new Date(shipment.createdAt).toISOString(),
      updatedAt: new Date(shipment.updatedAt).toISOString(),
    }));

    return res.json({
      shipments: formattedShipments,
      totalCount,
      pageInfo: {
        currentPage: numericPage,
        totalPages,
        hasNextPage: numericPage < totalPages,
        hasPreviousPage: numericPage > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching shipments:', error);
    return res.status(500).json({ message: 'Failed to fetch shipments' });
  }
};

// GET /api/shipments/:id
exports.getShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const shipment = await Shipment.findByPk(id, { raw: true });
    if (!shipment) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    return res.json({
      id: shipment.id.toString(),
      trackingNumber: shipment.trackingNumber,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      carrier: shipment.carrier,
      weight: parseFloat(shipment.weight),
      dimensions: shipment.dimensions,
      estimatedDelivery: shipment.estimatedDelivery
        ? new Date(shipment.estimatedDelivery).toISOString()
        : null,
      actualDelivery: shipment.actualDelivery
        ? new Date(shipment.actualDelivery).toISOString()
        : null,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      creatorEmail: shipment.creatorEmail || null,
      createdAt: new Date(shipment.createdAt).toISOString(),
      updatedAt: new Date(shipment.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error('Error fetching shipment:', error);
    return res.status(500).json({ message: 'Failed to fetch shipment' });
  }
};

// POST /api/shipments
exports.createShipment = async (req, res) => {
  try {
    const input = req.body || {};

    if (!input.trackingNumber) {
      return res.status(400).json({ message: 'Tracking number is required' });
    }

    const existing = await Shipment.findOne({
      where: { trackingNumber: input.trackingNumber },
    });
    if (existing) {
      return res.status(400).json({ message: 'Tracking number already exists' });
    }

    let creatorEmail = null;
    if (req.user && req.user.id) {
      const userRecord = await User.findByPk(req.user.id);
      creatorEmail = userRecord ? userRecord.email : null;
    }

    const shipment = await Shipment.create({
      ...input,
      estimatedDelivery: input.estimatedDelivery
        ? new Date(input.estimatedDelivery)
        : null,
      creatorEmail,
    });

    return res.status(201).json({
      id: shipment.id.toString(),
      trackingNumber: shipment.trackingNumber,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      carrier: shipment.carrier,
      weight: parseFloat(shipment.weight),
      dimensions: shipment.dimensions,
      estimatedDelivery: shipment.estimatedDelivery
        ? shipment.estimatedDelivery.toISOString()
        : null,
      actualDelivery: shipment.actualDelivery
        ? shipment.actualDelivery.toISOString()
        : null,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      creatorEmail: shipment.creatorEmail,
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    return res.status(500).json({ message: error.message || 'Failed to create shipment' });
  }
};

// PUT /api/shipments/:id
exports.updateShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.id) {
      delete updateData.id;
    }

    if (updateData.estimatedDelivery) {
      updateData.estimatedDelivery = new Date(updateData.estimatedDelivery);
    }
    if (updateData.actualDelivery) {
      updateData.actualDelivery = new Date(updateData.actualDelivery);
    }

    const [affectedRows] = await Shipment.update(updateData, { where: { id } });
    if (affectedRows === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const shipment = await Shipment.findByPk(id, { raw: true });

    return res.json({
      id: shipment.id.toString(),
      trackingNumber: shipment.trackingNumber,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      carrier: shipment.carrier,
      weight: parseFloat(shipment.weight),
      dimensions: shipment.dimensions,
      estimatedDelivery: shipment.estimatedDelivery
        ? new Date(shipment.estimatedDelivery).toISOString()
        : null,
      actualDelivery: shipment.actualDelivery
        ? new Date(shipment.actualDelivery).toISOString()
        : null,
      customerName: shipment.customerName,
      customerEmail: shipment.customerEmail,
      creatorEmail: shipment.creatorEmail || null,
      createdAt: new Date(shipment.createdAt).toISOString(),
      updatedAt: new Date(shipment.updatedAt).toISOString(),
    });
  } catch (error) {
    console.error('Error updating shipment:', error);
    return res.status(500).json({ message: error.message || 'Failed to update shipment' });
  }
};

// DELETE /api/shipments/:id
exports.deleteShipment = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedRows = await Shipment.destroy({ where: { id } });
    if (deletedRows === 0) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting shipment:', error);
    return res.status(500).json({ message: error.message || 'Failed to delete shipment' });
  }
};

