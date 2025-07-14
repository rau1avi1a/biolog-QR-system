# Dockerfile
FROM node:22-alpine

# 1. Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# 2. Build your Next.js app
COPY . .
RUN npm run build

# 3. Expose the port and set the startup command
EXPOSE 8080
CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port $PORT"]
