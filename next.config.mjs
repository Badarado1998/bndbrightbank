/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude native modules that are only needed for local SQLite mode.
  // On Vercel (MySQL/Supabase mode), these are never used and would fail to load.
  serverExternalPackages: ['sqlite3', 'better-sqlite3'],
};

export default nextConfig;
