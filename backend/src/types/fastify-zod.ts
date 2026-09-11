import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';

// Istanza Fastify tipizzata con lo ZodTypeProvider (solo per derivare il tipo).
export function buildZodApp() {
  return Fastify().withTypeProvider<ZodTypeProvider>();
}

export type FastifyZodInstance = ReturnType<typeof buildZodApp>;
