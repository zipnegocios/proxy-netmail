/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  output: 'export',
  distDir: 'dist',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
