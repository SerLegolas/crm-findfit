import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import { authRoutes } from './routes/auth.js';
import { clientsRoutes } from './routes/clients.js';
import { tasksRoutes } from './routes/tasks.js';
import { notesRoutes } from './routes/notes.js';
import { usersRoutes } from './routes/users.js';
import { emailRoutes } from './routes/email.js';
import { templatesRoutes } from './routes/templates.js';
import { imapRoutes } from './routes/imap.js';
import { companyRoutes } from './routes/company.js';
import { communicationsRoutes } from './routes/communications.js';
import { analyticsRoutes } from './routes/analytics.js';
import { errorHandler } from './middleware/error-handler.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
}).withTypeProvider<ZodTypeProvider>();

// Compilatori zod per validazione/serializzazione degli schemi delle route
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

// Middleware globali
fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Cookie (per autenticazione da session cookie)
fastify.register(cookie);

// Swagger Documentation
fastify.register(swagger, {
  swagger: {
    info: {
      title: 'CRM FindFit API',
      description: 'Documentazione API del CRM FindFit',
      version: '1.0.0',
    },
    host: process.env.API_URL || 'localhost:4000',
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      Bearer: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'Bearer token (es. Bearer crm_abc123...)',
      },
      Cookie: {
        type: 'apiKey',
        name: 'session',
        in: 'cookie',
        description: 'Cookie di sessione',
      },
    },
  },
});

fastify.register(swaggerUI, {
  routePrefix: '/docs',
});

// Error handler globale
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Routes
fastify.register(authRoutes, { prefix: '/api/v1/auth' });
fastify.register(clientsRoutes, { prefix: '/api/v1/clients' });
fastify.register(tasksRoutes, { prefix: '/api/v1/tasks' });
fastify.register(notesRoutes, { prefix: '/api/v1/notes' });
fastify.register(usersRoutes, { prefix: '/api/v1/users' });
fastify.register(emailRoutes, { prefix: '/api/v1/email' });
fastify.register(templatesRoutes, { prefix: '/api/v1/templates' });
fastify.register(imapRoutes, { prefix: '/api/v1/imap' });
fastify.register(companyRoutes, { prefix: '/api/v1/company' });
fastify.register(communicationsRoutes, { prefix: '/api/v1/communications' });
fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });

const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

fastify.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`📚 Swagger UI at http://${HOST}:${PORT}/docs`);
});

