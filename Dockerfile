FROM node:22
WORKDIR /app

# Install eSpeak-NG TTS for local text-to-speech support with voice tweaking
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

# Create temp directory for TTS files
RUN mkdir -p /tmp/zenbot && chmod 777 /tmp/zenbot

EXPOSE 8080
CMD ["node", "dist/app.js"]