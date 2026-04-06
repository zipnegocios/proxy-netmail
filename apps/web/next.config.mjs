/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@proxy-netmail/shared'],
  output: 'standalone',
  // Configurar imágenes
  images: {
    unoptimized: true,
  },
  // Deshabilitar optimización de fuentes para evitar descargas durante build
  optimizeFonts: false,
  // Deshabilitar generación estática
  staticPageGenerationTimeout: 1,
};

export default nextConfig;
