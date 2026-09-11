/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "xlsx"],
  },
  // Evita file .xlsx corrotti generati con la libreria "xlsx" (SheetJS)
  // in produzione: la minificazione swc può rompere il bundle della libreria.
  swcMinify: false,
};

module.exports = nextConfig;
