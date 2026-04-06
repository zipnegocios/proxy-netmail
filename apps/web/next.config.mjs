/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  output: 'standalone',
  // Deshabilitar prerender estático de páginas que usan next-auth
  staticPageGenerationTimeout: 0,
  // Configurar imágenes para standalone
  images: {
    unoptimized: true,
  },
  // Evitar errores de prerender en páginas dinámicas
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
};

export default nextConfig;
