FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./

# Create public directory before npm install
RUN mkdir -p public

RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]