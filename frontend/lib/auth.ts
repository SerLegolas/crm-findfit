import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/** Legge il secret JWT da env; in produzione è obbligatorio (niente fallback hardcoded). */
function getJwtSecret(name: "JWT_SECRET" | "SUPER_JWT_SECRET"): Uint8Array {
  const secret = process.env[name];
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${name} non configurato in produzione`);
    }
    // In sviluppo: valore stabile ma NON sicuro (solo per il server locale)
    return new TextEncoder().encode(
      name === "JWT_SECRET"
        ? "dev-insecure-jwt-secret"
        : "dev-insecure-super-jwt-secret"
    );
  }
  return new TextEncoder().encode(secret);
}

const JWT_SECRET = getJwtSecret("JWT_SECRET");

const COOKIE_NAME = "session";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  companyId: string;
};

/** Crea un JWT e lo salva nei cookie */
export async function createSession(user: AuthUser): Promise<string> {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);

  const isProduction = process.env.NODE_ENV === "production";

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // In sviluppo (NODE_ENV !== 'production') il cookie non è "secure" e usa
    // sameSite "lax" per permettere il login su HTTP locale.
    // In produzione il cookie è forzato secure: true (solo HTTPS).
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 giorni
  });

  console.log(
    `[AUTH] Cookie di sessione creato per ${user.email} (role=${user.role}, companyId=${user.companyId}) - secure=${isProduction ? "true" : "false"}`
  );

  return token;
}

/** Distrugge la sessione cancellando il cookie */
export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Legge e verifica il JWT dal cookie. Verifica l'utente sul DB e restituisce i dati aggiornati. */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const tokenUser = payload as { id?: string };
    if (!tokenUser?.id) return null;

    // Usa sempre i dati aggiornati dal DB (companyId, ruolo, nome, ecc.)
    // invece di fidarsi del token: evita che una sessione obsoleta
    // (es. azienda riassegnata o ruolo cambiato) usi dati errati.
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        companyId: users.companyId,
      })
      .from(users)
      .where(eq(users.id, tokenUser.id))
      .limit(1);

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
    };
  } catch {
    return null;
  }
}

/** Verifica la password in chiaro contro l'hash */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Genera l'hash di una password */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

/** Helper per API routes: estrae l'utente corrente o restituisce 401 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/** Helper per API routes: richiede ruolo admin */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Forbidden");
  }
  return user;
}

/** Helper per API routes: restituisce il companyId dell'utente autenticato */
export async function requireCompany(): Promise<string> {
  const user = await requireAuth();
  return user.companyId;
}

/** Genera un ID company predefinito (usato per migrazione) */
export const DEFAULT_COMPANY_ID = "default-company-id";

// ── Superuser ──

const SUPER_JWT_SECRET = getJwtSecret("SUPER_JWT_SECRET");

const SUPER_COOKIE_NAME = "super_session";

export const SUPERUSER_USERNAME = "ADMIN";

/** Password superuser: letta SOLO da env (obbligatoria; nessuna derivazione prevedibile). */
export const SUPER_PASSWORD = process.env.SUPER_PASSWORD;

export async function createSuperSession(): Promise<string> {
  const token = await new SignJWT({ role: "superadmin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(SUPER_JWT_SECRET);

  const cookieStore = await cookies();
  cookieStore.set(SUPER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 ore
  });

  return token;
}

export async function destroySuperSession() {
  const cookieStore = await cookies();
  cookieStore.set(SUPER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSuperUser(): Promise<{ role: string } | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SUPER_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SUPER_JWT_SECRET);
    return payload as unknown as { role: string };
  } catch {
    return null;
  }
}

export async function requireSuperUser(): Promise<{ role: string }> {
  const su = await getSuperUser();
  if (!su || su.role !== "superadmin") {
    throw new Error("Unauthorized");
  }
  return su;
}
