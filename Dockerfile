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

ENV ARCHIVE_THRESHOLD=0.8
ENV RETRIEVE_THRESHOLD=0.3
ENV HOST=0.0.0.0
ENV MONGODB_URI=mongodb://localhost:27017/memorydb
# set to --debug to enable debug logging in docker-compose
ENV DEBUG="" 

CMD "sh" "-c" "node build/index.js --log --host=$HOST --port=3000 $DEBUG"
