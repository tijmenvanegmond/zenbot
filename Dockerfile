FROM node:22
WORKDIR /app

# Install TTS dependencies: eSpeak-NG for local voice synthesis
RUN apt-get update && apt-get install -y \
    espeak-ng \
    alsa-utils \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /tmp/zenbot

COPY package*.json ./
RUN npm ci
COPY dist dist
COPY personalities personalities

# Create directories for TTS files
RUN mkdir -p /tmp/zenbot && chmod 777 /tmp/zenbot

# Port will be set via environment variable (default 3001)
EXPOSE 3001
CMD ["node", "dist/app.js"]