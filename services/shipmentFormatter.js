const formatShipment = (shipment) => {
  if (!shipment) return null;

  const plain = shipment.get ? shipment.get({ plain: true }) : shipment;

  return {
    id: plain.id.toString(),
    trackingNumber: plain.trackingNumber,
    origin: plain.origin,
    destination: plain.destination,
    status: plain.status,
    carrier: plain.carrier,
    weight: plain.weight != null ? parseFloat(plain.weight) : null,
    dimensions: plain.dimensions,
    estimatedDelivery: plain.estimatedDelivery
      ? new Date(plain.estimatedDelivery).toISOString()
      : null,
    actualDelivery: plain.actualDelivery
      ? new Date(plain.actualDelivery).toISOString()
      : null,
    customerName: plain.customerName,
    customerEmail: plain.customerEmail,
    creatorEmail: plain.creatorEmail || null,
    currentLocation: plain.currentLocation || null,
    currentLat:
      plain.currentLat !== null && plain.currentLat !== undefined
        ? parseFloat(plain.currentLat)
        : null,
    currentLng:
      plain.currentLng !== null && plain.currentLng !== undefined
        ? parseFloat(plain.currentLng)
        : null,
    pinCode: plain.pinCode || null,
    lastLocationUpdate: plain.lastLocationUpdate
      ? new Date(plain.lastLocationUpdate).toISOString()
      : null,
    createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : null,
    updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
  };
};

module.exports = {
  formatShipment,
};

