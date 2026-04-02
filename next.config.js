/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output bundles everything needed for production into .next/standalone
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs', 'exceljs'],
  },
}

module.exports = nextConfig
