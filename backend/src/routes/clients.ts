import type { FastifyZodInstance } from '../types/fastify-zod.js';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { ClientService } from '../services/client.service.js';
import { clientSchema } from '@crm/shared/types/clients';

export async function clientsRoutes(fastify: FastifyZodInstance) {
  
  // GET /api/v1/clients
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      querystring: z.object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10),
        search: z.string().optional(),
        status: z.enum(['lead', 'suspect', 'won', 'closed_lost']).optional(),
        categoria: z.string().optional(),
        userId: z.string().optional(),
        consent: z.enum(['true', 'false']).optional(),
        sort: z.string().default('createdAt'),
        order: z.enum(['asc', 'desc']).default('desc'),
      }),
      response: {
        200: z.object({
          data: z.array(z.any()),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
        }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        500: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { page, limit, search, status, categoria, userId, consent, sort, order } = request.query;
    const user = request.user!;

    const result = await ClientService.list({
      companyId: user.companyId,
      userId: user.role === 'admin' ? userId : user.id,
      page,
      limit,
      search,
      status,
      categoria,
      consent: consent === 'true' ? true : consent === 'false' ? false : undefined,
      sort,
      order,
    });

    return reply.send(result);
  });

  // GET /api/v1/clients/:id
  fastify.get('/:id', {
    preHandler: [authenticate],
    schema: {
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        200: z.any(),
        404: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user!;

    const client = await ClientService.findById(id, user.companyId, user.id, user.role === 'admin');
    if (!client) {
      return reply.code(404).send({ error: 'Cliente non trovato' });
    }

    return reply.send(client);
  });

  // POST /api/v1/clients
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: clientSchema,
      response: {
        201: z.any(),
        400: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        403: z.object({ error: z.string() }),
        409: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const user = request.user!;
    const data = request.body;

    const client = await ClientService.create({
      ...data,
      companyId: user.companyId,
      userId: user.role === 'admin' ? null : user.id,
    });

    return reply.code(201).send(client);
  });

  // PATCH /api/v1/clients/:id
  fastify.patch('/:id', {
    preHandler: [authenticate],
    schema: {
      params: z.object({
        id: z.string().uuid(),
      }),
      body: clientSchema.partial().extend({
        noteContent: z.string().optional(),
        emailConsent: z.boolean().optional(),
      }),
      response: {
        200: z.any(),
        400: z.object({ error: z.string() }),
        401: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user!;
    const data = request.body;

    const client = await ClientService.update({
      id,
      ...data,
      companyId: user.companyId,
      userId: user.id,
      isAdmin: user.role === 'admin',
    });

    return reply.send(client);
  });

  // DELETE /api/v1/clients/:id
  fastify.delete('/:id', {
    preHandler: [authenticate],
    schema: {
      params: z.object({
        id: z.string().uuid(),
      }),
      response: {
        204: z.any(),
        401: z.object({ error: z.string() }),
        404: z.object({ error: z.string() }),
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const user = request.user!;

    await ClientService.delete(id, user.companyId, user.id, user.role === 'admin');
    return reply.code(204).send();
  });
}
