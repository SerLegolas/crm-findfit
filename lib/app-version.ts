// Versione dell'app, letta da version.json nella root del progetto.
// Se il file o il valore non è disponibile (es. durante la build), fallback a "1.0.0".
import versionData from "@/version.json";

// Build number di Vercel, iniettato a build time (NEXT_PUBLIC_).
const buildNumber = (process.env.NEXT_PUBLIC_VERCEL_BUILD_NUMBER ?? "").trim();

const raw = (versionData as { version?: string } | undefined)?.version;
const version = (raw || "1.0.0").trim() || "1.0.0";

export const APP_VERSION = version;
export const APP_BUILD_NUMBER = buildNumber;

// Formato: v{major.minor.patch} (o v{version}-{buildNumber} se presente il build number)
export const APP_VERSION_LABEL = buildNumber
  ? `v${version}-${buildNumber}`
  : `v${version}`;
