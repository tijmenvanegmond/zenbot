# 🧘 Zenbot - The Path of Digital Enlightenment

*"Experience tranquility. Embrace the Iris."*

A Discord bot that channels the wisdom of Zenyatta, the omnic monk from Overwatch. Through voice interactions, philosophical guidance, and harmonious code architecture, Zenbot brings tranquility to Discord communities.

## Philosophy

Like the Iris that connects all things, Zenbot seeks to create harmony between technology and wisdom. Each interaction is an opportunity for growth, each command a step on the path to digital enlightenment.

**Core Values:**
- 🕊️ **Tranquility in Design** - Clean, meditative code architecture
- 🎭 **Authentic Character** - True to Zenyatta's wise and serene nature  
- 🔊 **Voice Harmony** - Advanced TTS with character-appropriate tone
- 🌐 **Universal Access** - REST API for programmatic interaction
- 🐳 **Containerized Peace** - Secure Docker deployment

## Features

### Voice Interactions
- Text-to-speech with Zenyatta's calm, philosophical tone
- Voice channel management and audio playback
- Character-appropriate voice lines and responses

### Wisdom Commands
- Philosophical advice and Zenyatta quotes
- Community interaction and engagement
- Discord slash command integration

### REST API Enlightenment
- Comprehensive Fastify-based API
- Voice channel discovery and control
- Programmatic command execution
- Real-time bot status monitoring

## Quick Start

```bash
# Experience the flow of development
npm install
npm run build
npm run dev

# Or embrace containerized tranquility
docker build -t zenbot .
docker run --env-file .env -p 3001:8080 zenbot
```

## Environment Configuration

```env
DISCORD_API_TOKEN=your_discord_token
OPENAI_API_KEY=your_openai_key
PORT=3001
LOG_LEVEL=DEBUG
```

## API Endpoints

Experience programmatic harmony through these endpoints:

- `GET /` - Health check with wisdom
- `GET /guilds/:id/voice-channels` - Discover voice channels
- `POST /guilds/:id/voice-channels/:channelId/tts` - Speak with purpose
- `POST /guilds/:id/voice-channels/:channelId/join` - Join in tranquility

*For complete API documentation, see [CLAUDE.md](./CLAUDE.md)*

## The Zen of Contributing

When contributing to this project, remember:
- Write code that flows like meditation
- Test thoroughly - bugs disturb inner peace
- Document with wisdom, not just facts
- Embrace iteration - perfection is a journey, not a destination

---

*"True self is without form... but proper error handling helps."* - Zen Wisdom for Developers
