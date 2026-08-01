import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

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

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 giorni
  });

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

const SUPER_JWT_SECRET = new TextEncoder().encode(
  process.env.SUPER_JWT_SECRET || "super-secret-change-in-production"
);

const SUPER_COOKIE_NAME = "super_session";

export const SUPERUSER_USERNAME = "ADMIN";

export function generateSuperPassword(): string {
  return `%${dayjs().format("DDMMYYYY")}%`;
}

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
