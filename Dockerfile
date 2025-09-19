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
ENV MONGODB_URI=mongodb://localhost:27017/memorydb
ENV ARCHIVE_THRESHOLD=0.8
ENV RETRIEVE_THRESHOLD=0.3
#ENV LOG_LEVEL=info
ENV TRANSPORT=http
ENV PORT=3000
ENV HOST=0.0.0.0

# Use shell form so environment variables (e.g. $PORT) are expanded at runtime.
# The server accepts --transport, --host and --port command-line flags.
CMD sh -c "node build/index.js --transport=$TRANSPORT --log --host=$HOST --port=$PORT"