/** @type {import('next').NextConfig} */
const nextConfig = {  
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Remove the webpack target override - let Next.js handle this
  experimental: {
    esmExternals: true,
    appDir: true,
  },
  
  staticPageGenerationTimeout: 120,
};

export default nextConfig;