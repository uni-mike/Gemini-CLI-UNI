import express from 'express';
import { createServer } from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { json } from 'body-parser';

import typeDefs from './graphql/typeDefs';
import resolvers from './graphql/resolvers';
import { connectDB } from './config/database';
import { redisClient } from './config/redis';
import { authenticateToken } from './middleware/auth';
import { logger } from './utils/logger';

async function startServer() {
  // Initialize Express app
  const app = express();
  const httpServer = createServer(app);

  // Connect to database
  await connectDB();
  await redisClient.connect();

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use(limiter);

  // CORS
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  }));

  // Body parsing middleware
  app.use(json({ limit: '10mb' }));

  // Create schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create WebSocket server
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  // Create Apollo Server
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
    formatError: (error) => {
      logger.error('GraphQL Error:', error);
      return {
        message: error.message,
        code: error.extensions?.code || 'INTERNAL_ERROR',
      };
    },
  });

  await server.start();

  // Apply GraphQL middleware
  app.use('/graphql', 
    authenticateToken,
    expressMiddleware(server, {
      context: async ({ req }) => {
        return {
          user: req.user,
          redis: redisClient
        };
      },
    })
  );

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Error handling middleware
  app.use((error: any, req: any, res: any, next: any) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });

  const PORT = process.env.PORT || 5000;

  httpServer.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await server.stop();
    await redisClient.quit();
    httpServer.close(() => {
      logger.info('Process terminated');
    });
  });
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});