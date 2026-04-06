/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  output: 'standalone',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
