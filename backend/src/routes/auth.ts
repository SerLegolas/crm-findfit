import type { FastifyReply } from 'fastify';
import type { FastifyZodInstance } from '../types/fastify-zod.js';

const fail = (reply: FastifyReply, what: string) =>
  reply.code(501).send({ error: `[auth] ${what} non ancora implementato` });

export async function authRoutes(app: FastifyZodInstance) {
  app.post('/login', async (_req, reply) => fail(reply, 'POST /login'));
  app.post('/register', async (_req, reply) => fail(reply, 'POST /register'));
  app.get('/me', async (_req, reply) => fail(reply, 'GET /me'));
  app.post('/logout', async (_req, reply) => fail(reply, 'POST /logout'));
}
