/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force all pages to be dynamic (no static generation)
  output: 'standalone',
  
  // Skip build-time checks
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.target = 'node18';
    } else {
      config.target = ['web', 'es2020'];
    }
    
    // Prevent bundling of server-only modules
    if (isServer) {
      config.externals = [...(config.externals || []), 'mongodb', 'mongoose'];
    }
    
    return config;
  },
  
  experimental: {
    esmExternals: true,
  },
  
  // IMPORTANT: Give pages time to build (not 0!)
  staticPageGenerationTimeout: 120, // 2 minutes instead of 0
};

export default nextConfig;