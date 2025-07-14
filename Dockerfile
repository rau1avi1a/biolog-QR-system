#Dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application using node directly
CMD ["npm", "start"]