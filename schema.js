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

  type AuthPayload {
    token: String!
    user: User!
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
    deleteShipment(id: ID!): Boolean!
  }

  type Subscription {
    shipmentAdded: Shipment!
    shipmentUpdated: Shipment!
    shipmentDeleted: ID!
  }
`;

module.exports = typeDefs;

