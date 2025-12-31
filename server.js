const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { createServer } = require('http');
const { useServer } = require('graphql-ws/lib/use/ws');
const { WebSocketServer } = require('ws');
const cors = require('cors');
require('dotenv').config();

const typeDefs = require('./schema');
const resolvers = require('./resolvers');
const { authenticateToken } = require('./middleware/auth');
const { connectDB } = require('./database/connection');
const { initializeSampleData } = require('./database/seed');

const app = express();

// Configure CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = await authenticateToken(token);
    return { user };
  },
  introspection: true,
  playground: true,
});

async function startServer() {
  try {
    // Connect to database
    await connectDB();
    
    // Create default admin if no users exist
    await initializeSampleData();
    
    // Start Apollo Server
    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    const PORT = process.env.PORT || 4000;
    const HOST = process.env.HOST || 'localhost';
    
    const httpServer = createServer(app);
    
    // Setup WebSocket server for subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: server.graphqlPath,
    });

    const serverCleanup = useServer(
      {
        schema: server.schema,
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
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`💡 Kill the process or change PORT in .env file`);
        console.error(`💡 To kill process: Get-NetTCPConnection -LocalPort ${PORT} | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`);
        process.exit(1);
      } else {
        throw error;
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

