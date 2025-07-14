FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./

# Create public directory before npm install
RUN mkdir -p public

# Install ALL dependencies (including dev) for building
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --omit=dev

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]