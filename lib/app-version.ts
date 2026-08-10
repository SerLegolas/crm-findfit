import pkg from "@/package.json";

// Versione statica letta da package.json (inclusa nel bundle al build time).
const version = pkg.version as string;

// Build number di Vercel, iniettato a build time (NEXT_PUBLIC_).
const buildNumber = (process.env.NEXT_PUBLIC_VERCEL_BUILD_NUMBER ?? "").trim();

export const APP_VERSION = version;
export const APP_BUILD_NUMBER = buildNumber;

// Formato: v{major.minor.patch}-{buildNumber} (o v{version} se manca il build number)
export const APP_VERSION_LABEL = buildNumber
  ? `v${version}-${buildNumber}`
  : `v${version}`;
