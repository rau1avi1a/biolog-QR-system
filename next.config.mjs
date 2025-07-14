/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack configuration for better async/await handling
  webpack: (config, { isServer }) => {
    // Ensure we're targeting environments that support async/await
    if (isServer) {
      config.target = 'node18'; // Server-side Node.js target
    } else {
      // Client-side targeting modern browsers with async/await support
      config.target = ['web', 'es2020'];
    }
    
    return config;
  },
  
  // Enable experimental features for better async handling
  experimental: {
    // This helps with ESM module resolution
    esmExternals: true,
  },
};

export default nextConfig;