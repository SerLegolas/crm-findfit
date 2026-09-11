import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
import { db } from '../db.js';
import { users } from '@crm/shared/db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  companyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// Estrae il token da Cookie o Authorization header
async function extractToken(request: FastifyRequest): Promise<string | null> {
  // 1. Prova dal cookie
  const cookieToken = request.cookies?.session;
  if (cookieToken) return cookieToken;

  // 2. Prova dall'header Authorization
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const token = await extractToken(request);
    if (!token) {
      return reply.code(401).send({ error: 'Non autenticato' });
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const tokenUser = payload as { id?: string };
    if (!tokenUser?.id) {
      return reply.code(401).send({ error: 'Token non valido' });
    }

    // Recupera utente aggiornato dal DB
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, tokenUser.id))
      .limit(1);

    if (!user || !user.isActive) {
      return reply.code(401).send({ error: 'Utente non trovato o disattivato' });
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as 'admin' | 'user',
      companyId: user.companyId,
    };
  } catch (error) {
    console.error('Auth error:', error);
    return reply.code(401).send({ error: 'Sessione non valida' });
  }
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authenticate(request, reply);
  if (!request.user) return;

  if (request.user.role !== 'admin') {
    return reply.code(403).send({ error: 'Accesso negato' });
  }
}
