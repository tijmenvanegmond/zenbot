FROM node:22-alpine
WORKDIR /app

# Security patches released after the base image was built (openssl, zlib...)
RUN apk upgrade --no-cache

# Create directories for TTS files
RUN mkdir -p /tmp/zenbot && chmod 777 /tmp/zenbot

COPY package*.json ./
RUN npm ci --omit=dev
COPY dist dist
COPY personalities personalities

# Port will be set via environment variable (default 3001)
EXPOSE 3001
# node:sqlite (zenbot.db) is "experimental" on Node 22 and says so on start
CMD ["node", "--disable-warning=ExperimentalWarning", "dist/app.js"]