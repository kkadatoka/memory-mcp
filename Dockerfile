# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (if present)
COPY package*.json ./



# Install all dependencies (including dev)
RUN npm install
RUN npm install express @types/express

# Copy the rest of the project files
COPY . .

# Build TypeScript code
RUN npm run build

# Remove dev dependencies after build for smaller image
RUN npm prune --production

# Expose port (optional, set if your app listens on a port)
EXPOSE 3000

# Document required environment variable
ENV MONGODB_URI=

# Start the app using npm start
CMD ["npm", "start"]
