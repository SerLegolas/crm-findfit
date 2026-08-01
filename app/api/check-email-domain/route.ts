import { NextRequest, NextResponse } from "next/server";
import { promises as dns } from "dns";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pattern Aruba nei nomi host (NS, MX)
const ARUBA_HOST_PATTERNS = ["aruba", "technorail", "register", "arubadns"];

// Range IP del cluster mail Aruba (verificato: mx.aruba.it e mx di domini hostati
// su Aruba risolvono in 62.149.128.x)
const ARUBA_MAIL_RANGES: Array<[number, number]> = [
  [0x3e958000, 0x3e9580ff], // 62.149.128.0 - 62.149.128.255
];

const ipv4ToInt = (ip: string): number | null => {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return null;
  }
  return (
    ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
  );
};

const isArubaIp = (ip: string): boolean => {
  const n = ipv4ToInt(ip);
  if (n === null) return false;
  return ARUBA_MAIL_RANGES.some(([start, end]) => n >= start && n <= end);
};

const matchesArubaPattern = (hostname: string): boolean =>
  ARUBA_HOST_PATTERNS.some((p) => hostname.includes(p));

/** POST: verifica se il dominio dell'email è ospitato su Aruba (NS, MX e IP dei server MX) */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (e: any) {
    if (e.message === "Unauthorized") {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (e.message === "Forbidden") {
      return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
    }
    return NextResponse.json({ error: e.message || "Errore" }, { status: 500 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";

    const atIndex = email.indexOf("@");
    if (atIndex === -1) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }

    const domain = email.slice(atIndex + 1).trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ error: "Email non valida" }, { status: 400 });
    }

    let dnsError: string | null = null;
    let ns: string[] = [];
    let mx: string[] = [];
    let mxIps: string[] = [];

    // 1) Nameserver del dominio (Aruba usa technorail / aruba / arubadns / register)
    try {
      ns = (await dns.resolveNs(domain)).map((h) => h.toLowerCase());
    } catch (e: any) {
      dnsError = e?.code || "NXDOMAIN";
    }

    // 2) Record MX
    try {
      const records = await dns.resolveMx(domain);
      mx = records.map((r) => r.exchange.toLowerCase());
    } catch {
      // Nessun record MX: il dominio potrebbe non avere email configurata
    }

    // 3) IP dei server MX (spesso l'MX punta al dominio del cliente, es. mx.nomedominio.it,
    //    ma i suoi IP appartengono ad Aruba)
    for (const exchange of mx) {
      try {
        const ips = await dns.resolve4(exchange);
        mxIps.push(...ips);
      } catch {
        // Host MX non risolvibile in IPv4
      }
    }

    const isAruba =
      ns.some(matchesArubaPattern) ||
      mx.some(matchesArubaPattern) ||
      mxIps.some(isArubaIp);

    return NextResponse.json({ domain, isAruba, ns, mx, mxIps, dnsError });
  } catch (error: any) {
    console.error("Errore verifica dominio email:", error);
    return NextResponse.json(
      { error: error.message || "Errore sconosciuto" },
      { status: 500 }
    );
  }
}
