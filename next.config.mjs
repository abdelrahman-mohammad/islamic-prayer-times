/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Enable experimental features if needed
  experimental: {
    // serverActions: true, // Enabled by default in Next.js 14+
  },
}

export default nextConfig