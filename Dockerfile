# Use official Node.js LTS image
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
# Copy only production deps and build output from builder
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi
COPY --from=build /app/build ./build

EXPOSE 3000
ENV MONGODB_URI=
CMD ["node", "build/index.js"]
