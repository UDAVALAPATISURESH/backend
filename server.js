const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { createServer } = require('http');
const { useServer } = require('graphql-ws/lib/use/ws');
const { WebSocketServer } = require('ws');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const cors = require('cors');
require('dotenv').config();

const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const { authenticateToken } = require('./middleware/auth');
const { connectDB } = require('./database/connection');
const { initializeSampleData } = require('./database/seed');
const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');

const app = express();

// Configure CORS - support multiple frontend URLs
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://frontendmain-m2sh.onrender.com',
  'https://frontend-cg3z.onrender.com',
  'http://localhost:3000'
].filter(Boolean); // Remove undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins for now (can restrict later)
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// REST API routes (alongside GraphQL)
app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);

async function startServer() {
  try {
    console.log('🔧 Building GraphQL schema...');
    // Build executable schema for both Apollo and WebSocket
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    console.log('✅ GraphQL schema built successfully');

    console.log('🚀 Starting Apollo Server...');
    const server = new ApolloServer({
      schema,
      context: async ({ req }) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const user = await authenticateToken(token);
        return { user };
      },
      introspection: true,
      playground: true,
    });

    // Connect to database
    console.log('📦 Connecting to database...');
    await connectDB();
    
    // Create default admin if no users exist
    await initializeSampleData();
    
    // Start Apollo Server
    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    const PORT = process.env.PORT || 4000;
    // Render requires binding to 0.0.0.0, not localhost
    const HOST = process.env.HOST || '0.0.0.0';
    
    const httpServer = createServer(app);
    
    // Setup WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: server.graphqlPath,
    });

    const serverCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          const token = ctx.connectionParams?.authorization?.replace('Bearer ', '') || ctx.connectionParams?.token;
          const user = await authenticateToken(token);
          return { user };
        },
      },
      wsServer
    );

    httpServer.listen(PORT, HOST, () => {
      console.log(`🚀 Server ready at http://${HOST}:${PORT}${server.graphqlPath}`);
      console.log(`📊 GraphQL Playground: http://${HOST}:${PORT}${server.graphqlPath}`);
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`🔌 WebSocket subscriptions ready at ws://${HOST}:${PORT}${server.graphqlPath}`);
    });

    // Cleanup WebSocket server on shutdown
    process.on('SIGTERM', () => {
      serverCleanup.dispose();
    });

    // Handle port already in use error gracefully
    httpServer.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(` Port ${PORT} is already in use.`);
        console.error(` Kill the process or change PORT in .env file`);
        console.error(` To kill process: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`);
        process.exit(1);
      } else {
        throw error;
      }
    });
  } catch (error) {
    console.error(' Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

