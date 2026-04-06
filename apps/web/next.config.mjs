/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  transpilePackages: ['@proxy-netmail/shared'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
