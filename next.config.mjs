/** @type {import('next').NextConfig} */
const nextConfig = {
  // A second dev server (e.g. a preview next to your own) needs its own build dir,
  // or both overwrite .next and the app breaks. Usage: NEXT_DIST_DIR=.next-preview
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/yuhonas/free-exercise-db/**',
      },
    ],
  },
}

export default nextConfig
