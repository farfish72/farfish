/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [],
  
  // Allow images from both production domains (using remotePatterns for security)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'app.farfish.xyz',    // New primary production domain
      },
      {
        protocol: 'https',
        hostname: 'farfish.vercel.app', // Legacy domain for backward compatibility
      },
    ],
  },
};

module.exports = nextConfig;
