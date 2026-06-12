/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules that are only needed for local SQLite mode.
  // On Vercel (MySQL/Supabase mode), these are never used and would fail to load.
  serverExternalPackages: ['sqlite3', 'better-sqlite3'],
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // the project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Ignore typescript errors during build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
