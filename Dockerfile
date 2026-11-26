FROM node:22-alpine
WORKDIR /app

# Create directories for TTS files
RUN mkdir -p /tmp/zenbot && chmod 777 /tmp/zenbot

COPY package*.json ./
RUN npm ci --omit=dev
COPY dist dist
COPY personalities personalities

# Port will be set via environment variable (default 3001)
EXPOSE 3001
CMD ["node", "dist/app.js"]