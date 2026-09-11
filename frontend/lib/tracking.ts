// Helper per il tracking delle email (pixel invisibile).

/** Base URL pubblica dell'app, per generare URL assoluti dei pixel di tracking. */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return "";
}

/** URL assoluto del pixel di tracking per un determinato trackingId. */
export function trackingPixelUrl(trackingId: string): string {
  return `${getAppBaseUrl()}/api/email/track/${trackingId}.png`;
}
