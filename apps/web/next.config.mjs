/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: '../../.next',
  transpilePackages: ['@proxy-netmail/shared'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
