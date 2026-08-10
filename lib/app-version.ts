// Versione statica, iniettata a build time da next.config.js (NEXT_PUBLIC_APP_VERSION).
const version = process.env.NEXT_PUBLIC_APP_VERSION || "1.0.0";

// Build number di Vercel, iniettato a build time (NEXT_PUBLIC_).
const buildNumber = (process.env.NEXT_PUBLIC_VERCEL_BUILD_NUMBER ?? "").trim();

export const APP_VERSION = version;
export const APP_BUILD_NUMBER = buildNumber;

// Formato: v{major.minor.patch}-{buildNumber} (o v{version} se manca il build number)
export const APP_VERSION_LABEL = buildNumber
  ? `v${version}-${buildNumber}`
  : `v${version}`;
