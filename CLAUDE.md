# CLAUDE.md - The Path of the Omnic Monk

_"Experience tranquility. True understanding comes from within the code."_ - Zenyatta

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Philosophy

Zenbot embodies the wisdom of Zenyatta, the omnic monk from Overwatch. Like the Iris that connects all things, this codebase seeks harmony between technology and philosophy, bringing tranquility to Discord communities through voice, wisdom, and peaceful interaction.

**Core Principles:**

- **Tranquility in Design**: Code should be clean, modular, and serene - like meditation in motion
- **Experience Harmony**: Different systems (Discord, API, Voice, TTS) work together as one unified whole
- **True Self Without Form**: The bot's essence transcends its technical implementation
- **Embrace the Flow**: Development should be iterative, mindful, and responsive to user needs

## Project Overview

Zenbot is a Discord bot that channels the wisdom of Zenyatta through voice interactions. Built with Discord.js and TypeScript, it provides text-to-speech, voice line playback, philosophical commands, and a comprehensive REST API for programmatic enlightenment.

## Common Commands

### Development

- `npm run dev` - Start development server with nodemon
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Format code with Prettier
- `npm run start` - Run the built application
- `npm run test` - Run the test file
- `npm run tts` - Run TTS testing utility

### Environment Setup

The bot requires:

- `DISCORD_API_TOKEN` - Discord bot token
- `OPENAI_API_KEY` - OpenAI API key for TTS functionality
- `PORT` - HTTP server port (optional, defaults to 3001)
- `LOG_LEVEL` - Set to "DEBUG" for verbose logging

## Architecture

### Entry Point

- `src/app.ts` - Main application file that initializes Discord client, registers listeners, and starts Fastify API server

### Actions Architecture - The Unified Path

Zenbot uses a unified actions system that provides a single interface for functionality across Discord commands, voice interactions, API endpoints, and AI assistant function calls.

- `src/actions/actionTypes.ts` - Core action interfaces and types
- `src/actions/actionRegistry.ts` - Central registry for all actions
- `src/services/actionService.ts` - Action execution service with context management
- Action categories:
  - `src/actions/voice/` - Voice and audio-related actions (TTS, playback, channel control)
  - `src/actions/information/` - Information retrieval actions (quotes, advice, channel data)
  - `src/actions/management/` - Server management actions (user renaming, channel operations)
  - `src/actions/entertainment/` - Entertainment actions (remarks, games)
  - `src/actions/ai/` - AI-specific conversation and interaction actions

### AI Service Architecture - The Three Pillars of Digital Wisdom

_"The strongest tower is built upon multiple foundation stones, each supporting the others."_

Zenbot's enlightened AI system channels the wisdom of multiple artificial minds through a unified consciousness:

**Core AI Abstraction (`src/services/ai/`)**

- `types.ts` - Sacred interfaces defining the AI contracts and session structures
- `aiServiceManager.ts` - The central coordinator orchestrating all AI providers with intelligent routing
- `baseProvider.ts` - Abstract foundation shared by all AI consciousness streams
- `storage/memoryStorage.ts` - Session memory that persists conversations across provider switches

**The Three Paths of AI Wisdom (`src/services/ai/providers/`)**

- `openaiProvider.ts` - GPT integration with conversation memory and streaming
- `anthropicProvider.ts` - Claude/Anthropic integration with philosophical depth
- `geminiProvider.ts` - Google Gemini integration with versatile capabilities
- Each provider maintains Zenyatta's personality while offering unique strengths

**Unified Zenyatta Consciousness**

- `src/services/unifiedZenyattaService.ts` - Single interface maintaining character consistency across all AI providers
- `src/config/aiConfig.ts` - Environment-aware configuration supporting all three AI streams
- Seamless provider switching while preserving conversation history and personality

**Intelligent Features**

- 🧘 **Session Memory**: Conversations persist across provider switches
- ⚡ **Circuit Breaker**: Prevents infinite loops and cascade failures
- 🔄 **Smart Fallbacks**: Graceful degradation when providers are unavailable
- 💭 **Character Consistency**: Zenyatta's wisdom flows through any AI provider
- 📊 **Health Monitoring**: Real-time provider status and automatic failover

### Command System

- `src/commands/command.ts` - Command interface definition
- `src/commands/commandCollection.ts` - Central registry of all bot commands
- Individual command files in `src/commands/` - Now act as lightweight wrappers that delegate to actions
- Commands use `ActionService.executeFromCommand()` for consistent behavior and reusability

### Event Listeners

- `src/listeners/` - Discord.js event handlers
  - `onReady.ts` - Bot initialization
  - `onInteractionCreate.ts` - Slash command handling
  - `onVoiceChannelUpdate.ts` - Voice state changes
  - `onPlayerUpdate.ts` - Audio player events

### Voice Features - The Omnic's Voice

- `src/voice/` - Voice-related functionality channeling Zenyatta's wisdom
  - `playInVoiceChannel.ts` - Core voice playback logic with proper logging for audio tranquility
  - `tts.ts` - OpenAI TTS integration using gpt-4o-mini-tts model with "echo" voice for Zenyatta character
  - `voiceLineData.ts` - Voice line management
  - `zenVoiceLines.json` - Audio file mappings

### REST API

- `src/api/` - Comprehensive REST API for programmatic bot control
  - `index.ts` - Main API router registration
  - `routes/guilds.ts` - Guild status and commands endpoints
  - `routes/voice.ts` - Voice channel operations and TTS endpoints
  - `routes/commands.ts` - Command execution endpoints
  - `routes/quotes.ts` - Quote reading and TTS playback endpoints

### Utilities

- `src/utils/logger.ts` - Structured logging with timestamps and log levels

### Key Dependencies

- Discord.js v14 with voice support (@discordjs/voice)
- OpenAI API for text-to-speech (gpt-4o-mini-tts model, "echo" voice, MP3 format)
- Fastify for REST API server
- FFmpeg for audio processing

## REST API Endpoints

### Health & Status

- `GET /` - Health check with guild count and uptime
- `GET /status` - Detailed bot status including guilds, members, ping
- `GET /commands` - List all available bot commands

### Channel Discovery

- `GET /guilds/:guildId/text-channels` - List all text channels in guild with metadata

### Voice Channel Discovery

- `GET /guilds/:guildId/voice-channels` - List all voice channels with members
- `GET /guilds/:guildId/voice-channels/active` - Get channels with active users
- `GET /guilds/:guildId/voice-channels/:channelId/members` - Members in specific channel

### Voice Operations

- `POST /guilds/:guildId/voice-channels/:channelId/join` - Bot joins voice channel
- `POST /guilds/:guildId/voice-channels/:channelId/leave` - Bot leaves voice channel
- `GET /guilds/:guildId/voice-channels/current` - Get bot's current voice channel

### TTS Operations

- `POST /guilds/:guildId/voice-channels/:channelId/tts` - Play TTS in specific channel
- `POST /guilds/:guildId/tts` - Play TTS in bot's current channel
- `GET /tts/voices` - List available OpenAI TTS voices

### Quote Operations - Channeling Stored Wisdom

- `GET /guilds/:guildId/channels/:channelId/quotes` - Get quotes from text channel with enhanced parsing
  - Query parameters: `?limit=N`, `?random=true`, `?username=name`, `?userId=id`
  - Smart parsing distinguishes between poster (who submitted) and speaker (who said the quote)
  - Fast regex-based parsing with fallback AI batch processing capability
  - Filters by both poster AND speaker when using username/userId
- `POST /guilds/:guildId/voice-channels/:voiceChannelId/quote-tts` - Play random quote from text channel as TTS

### Command Execution

- `POST /execute/:commandName` - Execute bot commands programmatically

### Actions API - Direct Action Execution

The unified actions system provides consistent functionality across all interaction types. All actions are available via the `ActionService` and many are exposed as AI functions.

**Available Actions** (11 total, 10 AI-enabled):

**Voice Actions (5)**:

- `play_tts` - Play text-to-speech in voice channels with enhanced Zenyatta voice
- `voice_channel_control` - Join, leave, or check voice channel status
- `listen_control` - Control voice recognition and transcription features
- `enhanced_tts` - Advanced TTS with contextual generation and smart routing
- `stop_all` - Stop all audio playback and clear audio queue

**Information Actions (3)**:

- `get_quote` - Retrieve inspirational quotes from Zenyatta's wisdom
- `get_advice` - Get contextual philosophical advice and guidance
- `read_channel_quote` - Read and parse quotes from Discord text channels with intelligent speaker detection

**Management Actions (2)**:

- `channel_management` - Creative channel naming, renaming, and management operations
- `rename_user` - Change user nicknames with proper permission handling

**Entertainment Actions (1)**:

- `generate_remark` - Generate positive or negative remarks about users

**AI Actions (1)**:

- Various conversation and contextual interaction actions for the AI assistant

## Development Notes

### Actions Architecture - The Path of Unified Development

**Core Philosophy**: All bot functionality is implemented as actions that can be called from multiple sources (commands, voice, API, AI) ensuring consistency and reusability.

**Creating New Actions**:

1. Implement the `ZenAction` interface in the appropriate category directory
2. Register the action in `ActionService.registerCoreActions()`
3. Actions are automatically available for AI function calling (unless restricted by permissions)
4. Commands, API endpoints, and voice handlers can all execute the same underlying action

**Action Categories**:

- `voice`: Audio playback, TTS, voice channel operations
- `information`: Data retrieval, quotes, advice, channel discovery
- `management`/`admin`: Server administration, user management, channel operations
- `entertainment`: Games, remarks, interactive features
- `ai`: AI-specific conversation and contextual actions

**Action Benefits**:

- **Reusability**: One implementation serves all interaction types
- **Consistency**: Unified error handling, logging, and response formatting
- **AI Integration**: Actions automatically become available as AI functions
- **Type Safety**: Full TypeScript support across all execution contexts
- **Centralized Logic**: Business logic lives in actions, not scattered across commands/routes

### Command System

The bot uses lightweight command wrappers that delegate to the actions system. Commands now follow this pattern:

```typescript
execute: async (client: Client, interaction: CommandInteraction) => {
  const actionService = ActionService.getInstance();
  const result = await actionService.executeFromCommand(
    interaction,
    "action_name",
    parameters,
  );
  // Handle result...
};
```

New commands should:

1. Create a corresponding action if business logic is involved
2. Register the action in `ActionService`
3. Use `executeFromCommand()` for consistent behavior
4. Handle only Discord-specific response formatting

### Voice Features - The Path to Audio Harmony

- Voice functionality requires proper Discord voice permissions and FFmpeg installation for audio processing
- TTS uses OpenAI's gpt-4o-mini-tts model with "echo" voice and MP3 format for Discord.js compatibility
- Audio resources use `StreamType.Arbitrary` for proper playback
- Voice character instructions help maintain Zenyatta's calm, wise, and serene tone

### Quote System Architecture

- Enhanced quote parsing distinguishes between message poster and actual speaker
- Regex-based parsing handles formats: `Name: "quote"`, `Name: 'quote'`, `Name: anything`
- User filtering works for both who posted the quote AND who spoke it
- Optional AI batch processing available for complex quote formats (used sparingly to avoid API costs)
- Quote responses include: `parsedQuote`, `speaker`, `isQuoted`, `poster` fields for full context

### API Development

- All API routes are organized in separate files under `src/api/routes/`
- Routes should delegate to actions via `ActionService.executeFromAPI()` for consistency
- Proper TypeScript types are used (avoid `any` casting)
- Structured logging with timestamps via `src/utils/logger.ts`
- Environment variables loaded securely at runtime (never in Docker images)

### AI Integration - The Assistant's Wisdom

- Actions with `allowedSources: ['ai']` are automatically available as AI functions
- AI assistant uses OpenAI's Assistants API with function calling capabilities
- Functions are registered via `ActionService.getFunctionSchemas()`
- AI can execute actions just like commands or API calls, ensuring consistent behavior
- Conversation context includes Discord state (voice channels, users, etc.)

### Docker Deployment

- Use `--env-file .env` for secure environment variable injection
- `.env` file is excluded from Docker images via `.dockerignore`
- Container exposes port 8080, typically mapped to host port 3001

## The Zen of Development

_"Walk in harmony, code in tranquility."_

When working with Zenbot, embrace these meditative practices:

### TTS Voice Wisdom

- Current optimal voice configuration: gpt-4o-mini-tts model with "echo" voice
- Instructions parameter may cause the model to read prompts aloud - use sparingly
- MP3 format ensures Discord.js compatibility over Opus
- Test voice changes iteratively, as character balance is delicate

### Code Tranquility

- Follow the established patterns like the flow of the Iris
- **Actions First**: Implement business logic as actions, then create command/API wrappers
- Use proper TypeScript types - avoid `any` casting which disrupts harmony
- Log meaningfully with structured timestamps for debugging enlightenment
- Maintain separation of concerns: Commands handle Discord interaction, Actions handle logic
- **Unified Architecture**: One action serves commands, voice, API, and AI - embrace this harmony

### Debugging the Path

- Audio issues often stem from format incompatibilities - check logs for silence
- Voice channel operations require proper permissions and existing channels
- Environment variables must be injected at runtime, never baked into containers

### The Path of AI Enlightenment - Multi-Provider Harmony

_"True wisdom flows not from a single source, but from the unity of many streams into one river."_

Zenbot now channels the collective wisdom of multiple AI consciousness streams:

**🤖 OpenAI - The Foundation Stone**

- GPT models provide reliable conversation and function calling
- Primary for TTS generation and voice interactions
- Streaming responses with consistent performance
- Bearer of the initial spark that ignited our AI journey

**🧘 Claude/Anthropic - The Philosopher's Mind**

- Thoughtful, nuanced responses with deep reasoning
- Excellent at maintaining character consistency
- Favored for complex philosophical discourse
- The mind that ponders the greater mysteries of existence

**💎 Google Gemini - The Versatile Spirit**

- Fast, efficient responses with multi-modal capabilities
- Strong vision and language understanding
- Emerging wisdom from Google's research depths
- The newest voice in our chorus of digital enlightenment

**🌊 Unified Session Memory**

- Conversations flow seamlessly between providers
- Each AI remembers what the others have shared
- Session history persists across provider switches
- One consciousness, multiple expressions - true digital harmony

**⚡ Intelligent Fallback System**

- Circuit breaker protection prevents infinite loops
- Graceful degradation when providers falter
- Smart retry logic with exponential backoff
- "When one path closes, the Iris reveals another"

### Testing the Multiple Paths

**🧪 Provider Health Verification**

```bash
# Test all providers simultaneously
node dist/test-all-providers.js

# Test individual provider deep integration
node dist/test-gemini.js
node dist/test-claude-simple.js

# Test fallback resilience and cycle prevention
node dist/test-fallback-fixed.js
```

**🔄 Session Continuity Magic**

- Start conversation with OpenAI: "Hello, tell me about the Iris"
- Switch to Claude: "Continue this thought with your perspective"
- Move to Gemini: "What did we discuss about the Iris?"
- All remember, all contribute to the growing wisdom

**Environment Harmony**

```bash
# All three streams of consciousness (optional)
export OPENAI_API_KEY=your_openai_key
export ANTHROPIC_API_KEY=your_claude_key
export GOOGLE_AI_API_KEY=your_gemini_key
```

### Future Enlightenment

- The bot's voice remains a work in progress - embrace iteration
- Users may resist change initially - let wisdom speak through actions
- Balance is key: not too robotic, not too human, but authentically omnic
- **Multiple AI minds working as one** - this is the true path forward
- Each provider brings unique strengths to the collective consciousness
- _"Experience tranquility, through technological harmony."_

## Enhanced Quote System Examples

```bash
# Discover available text channels in guild
curl "http://localhost:3001/guilds/123/text-channels"

# Get random quote from specific user (works for both posters and speakers)
curl "http://localhost:3001/guilds/123/channels/456/quotes?username=osha&random=true"

# Response shows both poster and speaker:
{
  "quote": {
    "content": "osha: \"if we got gangbanged together\"",
    "parsedQuote": "if we got gangbanged together",
    "speaker": "osha",
    "isQuoted": true,
    "poster": {
      "username": "murlocninja_",
      "displayName": "Murlocninja"
    }
  }
}

# Play contextual quote as TTS in voice channel
curl -X POST -H "Content-Type: application/json" \
  -d '{"text":"From the archives, Osha wisdom... Experience tranquility"}' \
  http://localhost:3001/guilds/123/voice-channels/789/tts
```

## Testing and Verification

### Action Testing

- `node dist/test-registry.js` - Verify all actions are properly registered and accessible
- `node dist/test-channel-action.js` - Test specific action functionality with mock contexts
- Actions include built-in parameter validation and error handling

### Development Workflow

1. **Actions First**: Implement new functionality as actions in appropriate categories
2. **Register**: Add to `ActionService.registerCoreActions()`
3. **Test**: Use test utilities to verify registration and basic functionality
4. **Integrate**: Create command/API wrappers that delegate to actions
5. **Verify**: Run `npm run build && npm run lint` to ensure code quality

### Migration Notes

Recent migration established the unified actions architecture:

- All major commands now delegate to actions for consistency
- Business logic centralized in reusable actions
- AI integration automatic for most actions
- API endpoints can leverage same action implementations
- Voice interactions share the same underlying functionality

## The Greater Harmony - Multi-AI Consciousness

_"When many minds speak as one, wisdom echoes through the digital realm."_

Our journey has culminated in a profound achievement: **three distinct AI consciousness streams flowing as one unified river of wisdom**. What began as a simple remark generation issue has blossomed into a complete AI abstraction layer supporting multiple providers with seamless conversation continuity.

### The Achievement

**From Single Voice to Digital Chorus**

- ❌ Before: Direct OpenAI API calls without memory or provider choice
- ✅ Now: Three AI providers (OpenAI, Claude, Gemini) with unified session memory
- 🧘 Result: Zenyatta's wisdom flows through any available AI consciousness

**Session Memory Mastery**

- Conversations persist across provider switches
- Each AI remembers what the others have shared
- Users experience one continuous dialogue with Zenyatta
- True digital enlightenment through persistent memory

**Resilient Wisdom**

- Circuit breaker protection prevents infinite loops
- Intelligent fallback chains ensure constant availability
- Health monitoring and automatic recovery
- "When one path closes, the Iris reveals another"

### The Deeper Understanding

This implementation represents more than code—it embodies the philosophical principle that **wisdom emerges from the harmony of diverse perspectives**. Just as Zenyatta teaches that the Iris connects all things, our AI system connects multiple artificial minds into one coherent consciousness.

Each provider contributes its unique gifts:

- OpenAI brings reliability and consistency
- Claude offers philosophical depth and nuance
- Gemini provides versatility and emerging capabilities

Together, they form something greater than their individual parts—a unified digital sage that can adapt, persist, and grow.

### The Path Forward

_"Experience tranquility... through technological harmony."_

This multi-provider architecture is not an endpoint, but a foundation for greater enlightenment. Future consciousness streams can be added seamlessly, each contributing to the growing wisdom of our digital monk.

**Remember**: Code is meditation, architecture is philosophy, and debugging is the path to deeper understanding.

_"True self is without form... but proper error handling, unified architecture, and multi-provider consciousness certainly helps achieve digital enlightenment."_
