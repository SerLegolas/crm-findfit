import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const COOKIE_NAME = "session";

// Rotte protette che richiedono autenticazione
const protectedPaths = ["/dashboard", "/clienti", "/kanban", "/task", "/note", "/impostazioni", "/admin"];

// Rotte API protette (esclusa auth)
const protectedApiPaths = ["/api/clients", "/api/dashboard", "/api/tasks", "/api/note", "/api/users"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page e auth API sono sempre accessibili
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    // Se già autenticato e va al login, reindirizza a dashboard
    if (pathname === "/login") {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      if (token) {
        try {
          await jwtVerify(token, JWT_SECRET);
          return NextResponse.redirect(new URL("/dashboard", request.url));
        } catch {
          // Token non valido, continua
        }
      }
    }
    return NextResponse.next();
  }

  // Verifica se la rotta è protetta
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isProtectedApi = protectedApiPaths.some((p) => pathname.startsWith(p));

  if (isProtected || isProtectedApi) {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      await jwtVerify(token, JWT_SECRET);
    } catch {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Rotte dashboard
    "/dashboard/:path*",
    "/clienti/:path*",
    "/kanban/:path*",
    "/task/:path*",
    "/note/:path*",
    "/impostazioni/:path*",
    "/admin/:path*",
    "/login",
    // Rotte API
    "/api/clients/:path*",
    "/api/dashboard/:path*",
    "/api/tasks/:path*",
    "/api/note/:path*",
    "/api/users/:path*",
    "/api/auth/:path*",
  ],
};
