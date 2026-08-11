import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ROUTE_FEATURE_MAP, isFeatureEnabled } from "@/lib/company-rules-edge";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production"
);

const SUPER_JWT_SECRET = new TextEncoder().encode(
  process.env.SUPER_JWT_SECRET || "super-secret-change-in-production"
);

const COOKIE_NAME = "session";
const SUPER_COOKIE_NAME = "super_session";

// Rotte protette che richiedono autenticazione
const protectedPaths = ["/dashboard", "/clienti", "/kanban", "/task", "/note", "/impostazioni", "/admin", "/comunicazioni"];

// Rotte API protette (esclusa auth)
const protectedApiPaths = ["/api/clients", "/api/dashboard", "/api/tasks", "/api/note", "/api/users", "/api/email-templates", "/api/imap-settings", "/api/company-settings", "/api/email", "/api/facebook", "/api/company-rules", "/api/comunicazioni"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Superuser login è pubblico
  if (pathname === "/superuser/login") {
    return NextResponse.next();
  }

  // Protezione rotte superuser (tranne login)
  if (pathname.startsWith("/superuser/")) {
    const token = request.cookies.get(SUPER_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/superuser/login", request.url));
    }
    try {
      await jwtVerify(token, SUPER_JWT_SECRET);
    } catch {
      return NextResponse.redirect(new URL("/superuser/login", request.url));
    }
    return NextResponse.next();
  }

  // Protezione API superuser
  if (pathname.startsWith("/api/superuser/") && pathname !== "/api/superuser/login") {
    const token = request.cookies.get(SUPER_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    try {
      await jwtVerify(token, SUPER_JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protezione API global-settings in PUT (solo superuser)
  if (pathname === "/api/global-settings" && request.method === "PUT") {
    const token = request.cookies.get(SUPER_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    try {
      await jwtVerify(token, SUPER_JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protezione API company-rules in PUT (solo superuser)
  if (pathname === "/api/company-rules" && request.method === "PUT") {
    const token = request.cookies.get(SUPER_COOKIE_NAME)?.value;
    if (!token) {
      // Potrebbe anche essere un utente normale via GET, ma PUT è solo superuser
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }
    try {
      await jwtVerify(token, SUPER_JWT_SECRET);
    } catch {
      return NextResponse.json({ error: "Sessione non valida" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Login, register e auth API sono sempre accessibili
  if (pathname === "/login" || pathname === "/register" || pathname.startsWith("/api/auth")) {
    // Se già autenticato e va al login/register, reindirizza a dashboard
    if (pathname === "/login" || pathname === "/register") {
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
      const { payload } = await jwtVerify(token, JWT_SECRET);
      const userPayload = payload as { companyId?: string };

      // Controllo feature: determina la feature key dalla path
      if (userPayload.companyId) {
        // Trova la feature key corrispondente al path
        let featureKey: string | undefined;
        for (const [routePrefix, key] of Object.entries(ROUTE_FEATURE_MAP)) {
          if (pathname === routePrefix || pathname.startsWith(routePrefix + "/") || pathname.startsWith(routePrefix + "?")) {
            featureKey = key;
            break;
          }
        }

        // Per API routes, usa il prefisso /api/... per trovare la feature
        if (!featureKey && pathname.startsWith("/api/")) {
          const apiPath = pathname.replace("/api", "");
          for (const [routePrefix, key] of Object.entries(ROUTE_FEATURE_MAP)) {
            if (apiPath === routePrefix || apiPath.startsWith(routePrefix + "/")) {
              featureKey = key;
              break;
            }
          }
        }

        if (featureKey) {
          const enabled = await isFeatureEnabled(userPayload.companyId, featureKey);
          if (!enabled) {
            if (pathname.startsWith("/api/")) {
              return NextResponse.json(
                { error: "Funzionalità disabilitata per questa azienda" },
                { status: 403 }
              );
            }
            // Per pagine web, redirect a dashboard
            return NextResponse.redirect(new URL("/dashboard", request.url));
          }
        }
      }
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
    // Rotte superuser
    "/superuser/:path*",
    // Rotte dashboard
    "/dashboard/:path*",
    "/clienti/:path*",
    "/kanban/:path*",
    "/task/:path*",
    "/note/:path*",
    "/impostazioni/:path*",
    "/admin/:path*",
    "/comunicazioni/:path*",
    "/login",
    "/register",
    // Rotte API
    "/api/clients/:path*",
    "/api/dashboard/:path*",
    "/api/tasks/:path*",
    "/api/note/:path*",
    "/api/users/:path*",
    "/api/auth/:path*",
    "/api/email-templates/:path*",
    "/api/imap-settings/:path*",
    "/api/company-settings/:path*",
    "/api/email/:path*",
    "/api/facebook/:path*",
    "/api/company-rules",
    "/api/comunicazioni/:path*",
    "/api/superuser/:path*",
    "/api/global-settings",
  ],
};
