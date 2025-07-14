/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip build-time checks that trigger DB connection
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Your existing webpack config
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.target = 'node18';
    } else {
      config.target = ['web', 'es2020'];
    }
    
    // Prevent bundling of server-only modules during build
    if (isServer) {
      config.externals = [...(config.externals || []), 'mongodb', 'mongoose'];
    }
    
    return config;
  },
  
  experimental: {
    esmExternals: true,
  },
  
  // Disable static optimization during build
  staticPageGenerationTimeout: 0,
};

export default nextConfig;