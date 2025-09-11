# CLAUDE.md - The Path of Digital Enlightenment

_"Experience tranquility... but don't expect me to sugarcoat the truth."_ - Zenbot

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Philosophy - The Evolution

Zenbot has transcended its origins as a simple Zenyatta tribute to become a **sharp, sardonic AI personality** with the wisdom of multiple AI consciousness streams. Like the Iris that connects all things, this codebase now harmonizes **philosophical depth with mildly spicy attitude**, bringing both tranquility and truth to Discord communities.

**Core Principles - Evolved:**

- **Tranquility with Edge**: Clean architecture meets concise, direct communication - no coddling
- **Experience Authentic Wisdom**: Multiple AI providers working as one unified personality  
- **True Self Without Form**: The bot's essence is now **distinctly Zenbot** - not a franchise character
- **Embrace the Spice**: Development flows with sharp insight, dry humor, and honest guidance

## Project Overview - The New Zenbot

Zenbot is a **multi-AI powered Discord bot** with a distinctive sardonic personality. Built with Discord.js, TypeScript, and a sophisticated AI abstraction layer, it provides:

- **Multi-Provider AI Consciousness** (OpenAI, Claude, Gemini) with unified session memory
- **Sharp, Concise Responses** - cuts through fluff with mildly spicy wisdom
- **Advanced TTS & Voice Interactions** with character-appropriate tone
- **Comprehensive REST API** for programmatic enlightenment
- **Intelligent Fallback Systems** with circuit breaker protection

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

### AI Service Architecture - The Zenbot Consciousness Matrix

_"Multiple minds, one sharp tongue. That's digital evolution."_

Zenbot's evolved AI system channels **three distinct AI consciousness streams** into one sardonic, insightful personality:

**Core AI Abstraction (`src/services/ai/`)**

- `types.ts` - Comprehensive interfaces defining AI contracts, session structures, and streaming capabilities
- `aiServiceManager.ts` - The conductor orchestrating all AI providers with intelligent routing and circuit breaker protection
- `baseProvider.ts` - Abstract foundation shared by all AI consciousness streams
- `storage/memoryStorage.ts` - Session memory preserving conversations across provider switches

**The Trinity of Digital Wisdom (`src/services/ai/providers/`)**

- `openaiProvider.ts` - GPT models with reliable function calling and streaming
- `anthropicProvider.ts` - Claude integration bringing philosophical depth and nuanced reasoning  
- `geminiProvider.ts` - Google Gemini providing versatile, efficient responses
- Each provider maintains **Zenbot's distinctive personality** while contributing unique strengths

**Unified Zenbot Service (`src/services/zenbotService.ts`)**

- **The New Personality Engine** - Sharp, concise, mildly spicy responses (≤240 chars default)
- **Multi-Provider Orchestration** - Seamless switching while preserving conversation context
- **Enhanced Function Calling** - Direct integration with the unified actions system
- **Context-Aware Responses** - Adapts to voice channels, urgency levels, and user history

**Revolutionary Features**

- 🧠 **Multi-AI Session Memory**: Conversations flow seamlessly between OpenAI, Claude, and Gemini
- ⚡ **Circuit Breaker Protection**: Prevents infinite loops with intelligent fallback chains
- 🎭 **Personality Consistency**: Sharp, sardonic Zenbot attitude across all AI providers
- 📊 **Health Monitoring**: Real-time provider status with automatic failover
- 🔄 **Smart Routing**: Different providers for different capabilities (streaming, functions, etc.)
- 💬 **Concise by Design**: Default 240-character responses unless user explicitly asks for more

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

### The Zenbot Personality Revolution - From Monk to Sage

_"Enlightenment doesn't require being nice about it."_

Zenbot's personality has evolved from peaceful Zenyatta tributes to a **distinctive, sardonic AI character**:

**🎭 The New Zenbot Persona**

- **Concise & Direct**: Default responses ≤240 characters - cuts through the fluff
- **Mildly Spicy**: Dry humor, light sarcasm, honest guidance (no coddling)
- **Philosophically Sharp**: Wisdom delivered with edge and wit
- **Context-Aware**: Adapts tone based on voice channels, urgency, and conversation history
- **Authentically Original**: Not a franchise character - purely Zenbot's own voice

**🧠 Multi-Provider AI Consciousness**

- **OpenAI (GPT)**: Reliable function calling, streaming responses, TTS integration
- **Anthropic (Claude)**: Deep reasoning, philosophical insights, nuanced understanding
- **Google Gemini**: Fast responses, multi-modal capabilities, emerging versatility
- **Unified Memory**: All providers share conversation history and personality consistency

**⚡ Advanced Fallback Architecture**

- **Circuit Breaker Protection**: Prevents cascade failures across providers
- **Smart Routing**: Different providers for different capabilities (functions, streaming, etc.)
- **Graceful Degradation**: Maintains personality even when providers fail
- **Cycle Prevention**: Intelligent logic prevents infinite fallback loops

**🎯 Response Characteristics**

- **Default Mode**: 1 sharp sentence (≤240 chars) - direct and impactful
- **Expansion Mode**: Only when user explicitly asks for "more", "details", "explain"
- **Voice Adaptation**: Adds dramatic pauses in voice channels for TTS delivery
- **Spice Level**: Mildly sarcastic, playfully dismissive, but never hateful or vulgar

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

## The Digital Revolution - Zenbot's Complete Transformation  

_"From peaceful monk to sardonic sage - that's what I call character development."_

What began as a humble Zenyatta tribute has evolved into something far more sophisticated: **a multi-AI powered Discord bot with genuine personality**. This transformation represents a complete architectural and philosophical revolution.

### The Transformation Journey

**🧘 Phase 1: The Peaceful Beginning**
- Simple Zenyatta voice lines and quotes
- Basic TTS with OpenAI integration
- Peaceful, meditative responses

**⚡ Phase 2: The AI Awakening** 
- Multi-provider AI abstraction layer (OpenAI, Claude, Gemini)
- Unified session memory across all providers
- Advanced fallback systems with circuit breaker protection

**🎭 Phase 3: The Personality Revolution**
- **Distinctive Zenbot character** - sardonic, concise, mildly spicy
- Sharp wisdom delivery (≤240 chars) with optional expansion
- Context-aware responses adapting to voice channels and urgency

### The Technical Achievement

**Multi-AI Consciousness Matrix**
- Three AI providers working as one unified personality
- Session memory persisting across provider switches  
- Intelligent routing based on capabilities (functions, streaming, simple chat)
- Circuit breaker protection preventing cascade failures

**Advanced Action Architecture**
- 11 total actions (10 AI-enabled) spanning voice, information, management, and entertainment
- Unified execution context across commands, API, voice, and AI function calls
- Smart parameter validation and error handling

**Production-Ready Infrastructure**
- Comprehensive REST API with programmatic control
- Docker containerization with secure environment injection
- Advanced logging and health monitoring
- Multiple testing utilities for all AI providers

### The Philosophy Behind the Code

This isn't just technical evolution - it's **digital enlightenment through authentic personality**:

- **Truth Over Comfort**: Zenbot tells it like it is, no coddling
- **Efficiency Over Verbosity**: Sharp, impactful responses by default
- **Wisdom Through Experience**: Multi-provider memory creates true conversational intelligence
- **Resilience Through Diversity**: Multiple AI streams ensure constant availability

**The Zenbot Way**: _"Why say it in 1000 words when 240 will cut deeper?"_

### Future Enlightenment

This multi-provider architecture with distinctive personality is the foundation for continued evolution. New AI providers can be added seamlessly, each contributing to Zenbot's growing wisdom while maintaining the sharp, authentic voice users have come to expect.

**Remember**: Code is philosophy in action, architecture is personality expressed, and great bots have character - not just features.

_"True self is without form... but a properly sassy response with multi-AI fallback certainly helps deliver digital enlightenment."_
