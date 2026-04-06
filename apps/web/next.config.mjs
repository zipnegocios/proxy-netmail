/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  // Deshabilitar completamente la generación de páginas estáticas
  staticPageGenerationTimeout: 1,
  // Evitar que se generen páginas estáticas para errores
  trailingSlash: true,
  experimental: {
    optimizeCss: false,
  },
};

export default nextConfig;
