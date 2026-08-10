/** @type {import('next').NextConfig} */
const nextConfig = {
  // Versione app, iniettata a build time per il client
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "1.0.0",
  },
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "xlsx"],
  },
  // Evita file .xlsx corrotti generati con la libreria "xlsx" (SheetJS)
  // in produzione: la minificazione swc può rompere il bundle della libreria.
  swcMinify: false,
};

module.exports = nextConfig;
