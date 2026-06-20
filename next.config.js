/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow next/image to optimize Supabase-hosted assets (project covers, plans, etc.)
    remotePatterns: [
      { protocol: 'https', hostname: 'lftvumbhogcixihjydwx.supabase.co' },
    ],
  },
};
module.exports = nextConfig;
