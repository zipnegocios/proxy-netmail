/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
