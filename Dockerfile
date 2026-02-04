FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server/ ./server/
COPY public/ ./public/

# Expose ports
EXPOSE 3000/tcp
EXPOSE 41234/udp

# Run the application
CMD ["node", "server/index.js"]
