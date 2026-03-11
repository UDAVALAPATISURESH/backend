const { gql } = require('apollo-server-express');

const typeDefs = gql`
  enum UserRole {
    ADMIN
    EMPLOYEE
  }

  enum ShipmentStatus {
    PENDING
    IN_TRANSIT
    DELIVERED
    CANCELLED
  }

  type User {
    id: ID!
    username: String!
    email: String!
    role: UserRole!
    scopes: [String!]
    isFirstLogin: Boolean
    googleId: String
  }

  type Shipment {
    id: ID!
    trackingNumber: String!
    origin: String!
    destination: String!
    status: ShipmentStatus!
    carrier: String!
    weight: Float!
    dimensions: String!
    estimatedDelivery: String!
    actualDelivery: String
    customerName: String!
    customerEmail: String!
    creatorEmail: String
    currentLocation: String
    currentLat: Float
    currentLng: Float
    pinCode: String
    lastLocationUpdate: String
    createdAt: String!
    updatedAt: String!
  }

  type ShipmentConnection {
    shipments: [Shipment!]!
    totalCount: Int!
    pageInfo: PageInfo!
  }

  type PageInfo {
    currentPage: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
  }

  input ShipmentFilter {
    status: ShipmentStatus
    carrier: String
    origin: String
    destination: String
    search: String
  }

  input SortInput {
    field: String!
    order: String!
  }

  input ShipmentInput {
    trackingNumber: String!
    origin: String!
    destination: String!
    status: ShipmentStatus!
    carrier: String!
    weight: Float!
    dimensions: String!
    estimatedDelivery: String!
    actualDelivery: String
    pinCode: String
    customerName: String!
    customerEmail: String!
  }

  input UpdateShipmentInput {
    id: ID!
    trackingNumber: String
    origin: String
    destination: String
    status: ShipmentStatus
    carrier: String
    weight: Float
    dimensions: String
    estimatedDelivery: String
    actualDelivery: String
    customerName: String
    customerEmail: String
  }

  input UpdateShipmentLocationInput {
    id: ID!
    currentLocation: String
    currentLat: Float
    currentLng: Float
    pinCode: String
    status: ShipmentStatus
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type ShipmentMessage {
    id: ID!
    shipmentId: ID!
    senderId: ID!
    senderName: String!
    message: String!
    createdAt: String!
  }

  type ShipmentLocationHistory {
    id: ID!
    shipmentId: ID!
    location: String
    latitude: Float
    longitude: Float
    createdAt: String!
  }

  type QRResponse {
    qrCode: String!
    secret: String!
  }

  type GeocodeResult {
    success: Boolean!
    formattedAddress: String
    pinCode: String
    lat: Float
    lng: Float
    error: String
  }

  type Query {
    # Shipment queries
    shipments(
      page: Int = 1
      limit: Int = 10
      filter: ShipmentFilter
      sort: SortInput
    ): ShipmentConnection!
    
    shipment(id: ID!): Shipment
    
    # User queries
    me: User
    users: [User!]!

    # Messages
    shipmentMessages(shipmentId: ID!): [ShipmentMessage!]!

    # Location History
    shipmentLocationHistory(shipmentId: ID!): [ShipmentLocationHistory!]!

    # Geocoding
    reverseGeocode(lat: Float!, lng: Float!): GeocodeResult!
    forwardGeocode(address: String!): GeocodeResult!
    geocodePinCode(pinCode: String!): GeocodeResult!
  }

  input UpdateUserInput {
    id: ID!
    username: String
    email: String
    password: String
    role: UserRole
    scopes: [String!]
  }

  type Mutation {
    # Authentication
    login(username: String, email: String, password: String!): AuthPayload!
    register(username: String!, email: String!, password: String!, role: UserRole!, scopes: [String!]): AuthPayload!

    # User mutations (Admin only)
    updateUser(input: UpdateUserInput!): User!
    deleteUser(id: ID!): Boolean!
    
    # User password change (for current user)
    changePassword(currentPassword: String!, newPassword: String!): Boolean!

    # Shipment mutations
    addShipment(input: ShipmentInput!): Shipment!
    updateShipment(input: UpdateShipmentInput!): Shipment!
    updateShipmentLocation(input: UpdateShipmentLocationInput!): Shipment!
    deleteShipment(id: ID!): Boolean!

    # Realtime communication
    sendShipmentMessage(shipmentId: ID!, message: String!): ShipmentMessage!

    # First-time login and OTP
    generateQR(userId: ID!): QRResponse!
    verifyOTP(userId: ID!, otp: String!, secret: String): AuthPayload!
    googleLogin(idToken: String!): AuthPayload!
  }

  type Subscription {
    shipmentAdded: Shipment!
    shipmentUpdated: Shipment!
    shipmentLocationUpdated: Shipment!
    shipmentDeleted: ID!

    shipmentMessageAdded(shipmentId: ID!): ShipmentMessage!
  }
`;

module.exports = typeDefs;

