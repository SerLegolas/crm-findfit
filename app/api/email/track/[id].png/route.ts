import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailLog } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GIF 1x1 trasparente
const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const pixelResponse = (headers: Record<string, string> = {}) =>
  new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      ...headers,
    },
  });

/** GET: pixel di tracking. Registra l'apertura dell'email e restituisce una GIF 1x1. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // id = trackingId (es. "abc-123" da /api/email/track/abc-123.png)
    const trackingId = id;

    if (trackingId) {
      const [log] = await db
        .select({ id: emailLog.id, openedAt: emailLog.openedAt })
        .from(emailLog)
        .where(eq(emailLog.trackingId, trackingId))
        .limit(1);

      // Registra l'apertura solo la prima volta
      if (log && !log.openedAt) {
        await db
          .update(emailLog)
          .set({ openedAt: new Date() })
          .where(eq(emailLog.id, log.id));
      }
    }

    return pixelResponse();
  } catch (error) {
    console.error("[EMAIL-TRACK] Errore nel tracciamento:", error);
    // Anche in caso di errore restituisci il pixel per non rompere l'email
    return pixelResponse();
  }
}
