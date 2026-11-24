# CLAUDE.md - Zenbot Development Guide

_"Experience tranquility... but don't expect me to sugarcoat the truth."_ - Zenbot

## Project Overview

Zenbot is a **multi-AI powered Discord bot** with a sardonic personality. Built with Discord.js, TypeScript, and a sophisticated AI abstraction layer.

**Key Features:**

- Multi-Provider AI (OpenAI, Claude, Gemini) with unified memory
- Sharp, concise responses with sardonic personality (see `ZENBOT_PERSONALITY.md`)
- Advanced TTS & voice interactions
- Comprehensive REST API
- Circuit breaker protection with intelligent fallbacks

## Common Commands

### Development

- `npm run dev` - Start development server with nodemon (see "One bot per token" below)
- `npm run build` - Compile TypeScript to JavaScript
- `npm run lint` - Format code with Prettier
- `npm run start` - Run the built application
- `npm run test` - Run the vitest suite (`npm run test:run` for a single run)
- `npm run tts -- "text" [profile] [out.wav]` - Render a voice profile to a WAV via Piper (`--list` for profiles)

**One bot per token:** two instances on the same token both receive every slash command and fight over voice (commands fail with "unknown interaction", the bot joins voice and stays silent). `npm run dev` logs in with `DISCORD_DEV_TOKEN` if set; otherwise it refuses to start while the live bot answers on `localhost:3001`. Stop the container first (`docker stop zenbot`) or use a separate test bot.

### Environment Setup

**Required:**
- `DISCORD_API_TOKEN` - Discord bot token

**AI (optional - without a key Zenbot runs on curated responses):**
- `GOOGLE_AI_API_KEY` - Gemini, the active provider (OpenAI/Anthropic are disabled in `src/config/aiConfig.ts`)
- `AI_ENABLED=false` - Turn AI off even when a key is set
- `GEMINI_MODEL` - Chat model (default `gemini-3.5-flash-lite`, ~1.5s; `gemini-3.5-flash` is sharper but ~25s). Google retires models regularly - a 404 "no longer available" means change this
- `GEMINI_FAST_MODEL` - Model for quote intros (default `gemini-3.5-flash-lite`)

**Optional:**
- `PORT` - HTTP server port (defaults to 3001)
- `LOG_LEVEL` - Set to "DEBUG" for verbose logging
- `PIPER_URL` - Piper TTS endpoint (defaults to `http://localhost:8080`)
- `DISCORD_DEV_TOKEN` - Separate test bot token used by `npm run dev`
- `LIVE_BOT_URL` - Where `npm run dev` checks for the live bot (defaults to `http://localhost:3001/`)

**Docker Setup:**
```bash
docker-compose up -d  # Starts Piper TTS container
```

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

### AI Service Architecture

**Core Components (`src/services/ai/`)**

- `aiServiceManager.ts` - Orchestrates all providers with circuit breaker protection
- `zenbotService.ts` - Personality engine with sharp, concise responses
- `providers/` - OpenAI, Claude, Gemini with unified memory

**Features:**

- Multi-AI session memory across all providers
- Circuit breaker protection preventing cascade failures
- Smart routing based on capabilities (functions, streaming, chat)
- Personality consistency across all AI providers

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
  - `onMessageCreate.ts` - `@Zenbot` chat (see below)

### @Zenbot Chat - Where Tool Calling Lives

- Mentioning the bot starts a free conversation through `ZenbotService.converse()` with function calling
- Tools offered: `read_channel_quote`, `roll_dice`, `set_voice_mood`, `channel_management`. Excluded: `speak`, voice control, listening, conference, `rename_user`
- The handler shows the reply and, if the author is in voice, speaks that same reply: "<name> asks: <message>", pause, reply. The AI never speaks for itself here, so text and voice can't diverge
- `set_voice_mood` (AI-only) stores a mood in `voiceMoodStore`; the handler speaks the reply with `piper-zen-<mood>`
- `[pause]` markers in replies are spoken as silence and removed from the text
- 5s per-user cooldown (⏳ reaction) to protect the Gemini quota
- Fixed commands (`/advice`, `/remark`, `/quote`) deliberately don't use tools: they make one direct call and speak exactly what they show
- The conversation itself lives in `src/services/zenbotChat.ts` (`getChatReply`, `speakReply`), shared with `/listen`

### /listen - Voice Conversation

- `listenControlAction.ts` captures each speaker, `speechToText.ts` transcribes (Gemini on `GEMINI_FAST_MODEL`, audio downmixed to 16kHz mono first; OpenAI Whisper only without a Gemini key)
- Zenbot only answers when the transcript contains its name (`WAKE_WORD`, tolerant of "Zen bot"/"ZennBot"/"Xenbot"), unless it's alone with one person
- One reply at a time per guild; what was heard and the reply are posted in the channel `/listen` was started from
- Each utterance is a Gemini request (transcription) - long sessions in busy channels use quota
- The bot and `/listen` share one voice connection per guild: `AudioManager` joins with `selfDeaf: false` and skips its idle leave while a listen session is active. Deafening or leaving there silently ends listening

### Voice System - Unified Architecture with Audio Effects

**Core Services (`src/services/voice/`):**

- `UnifiedVoiceService.ts` - Single entry point for all TTS operations
- `ProfileManager.ts` - Voice profile management (25+ profiles with mood variations)
- `AudioManager.ts` - Voice channel sessions, playback queue, auto-leave on idle
- `types.ts` - Voice interfaces and configuration types with audio effects support

**TTS Providers (`src/services/voice/providers/`):**

- `ProviderFactory.ts` - Provider selection with intelligent fallback
- `PiperProvider.ts` - **Primary**: Neural TTS via HTTP API with audio effects (john, lessac, ryan, amy, joe voices)
- `SystemProvider.ts` - Windows/macOS native TTS fallback

**Piper TTS Server (`piper-server/`):**

- `server.py` - Flask HTTP server; voices stay loaded in memory via the piper Python API (~0.2s per request)
- `effects.py` - numpy/scipy audio processing (phase-vocoder pitch shift, octave layer, room reverb, robot, echo, distortion, bitcrush)
- `README.md` - Complete API documentation for effects
- Docker containerized at `http://localhost:8080` (configurable via `PIPER_URL`); `piper-tts` is pinned in `Dockerfile.piper`

**Audio Effects:**

- **Presets**: zen (Zenbot's voice: robot over a 20% octave-down layer + 0.25s room), omnic (robot only), cave, demon, chipmunk, glitch, radio, ghost, telephone
- **Individual**: reverb (0-1), pitch (-12 to +12 semitones, duration preserved), distortion (1-50), echo (ms), bitcrush (1-16 bits)
- **Delivery**: `noise` (tone variation, piper default 0.667) and `noise_w` (timing variation, default 0.8) - lower is calmer and more even
- **Pauses**: `[pause]` or `[pause:0.8]` in the text inserts exact silence (seconds, max 3). System TTS replaces markers with a comma
- **API Usage**: `/api/tts?text=...&voice=joe&effect=zen` or custom combinations

**Voice Profiles with Moods:**

- **Piper Zen** (Default Zenbot voice - joe, `zen` preset, noise 0.45 / noise_w 0.5):
  - `piper-zen` - Default (0.78 speed)
  - `piper-zen-calm` (0.7), `piper-zen-wise` (0.66), `piper-zen-playful` (0.85), `piper-zen-intense` (0.92)

- **Piper Omnic** (previous default, john + omnic): `piper-omnic`, `-calm`, `-intense`, `-wise`, `-playful`
- **Other Piper Profiles**: `piper-default` (john, slow), `piper-john`, `piper-lessac`, `piper-ryan`, `piper-amy`, `piper-joe`, `piper-danny`, `piper-energetic`, `piper-calm`, `piper-sharp`, `piper-fast`, `piper-deep`
- Personality names resolve through the map, moods included: `getConfig("zenbot-default:calm")` → `piper-zen-calm`. Unknown names log a warning and use `piper-zen`
- **System**: `system-default` (Microsoft David/Alex)

**Personality-to-Voice Mapping (`src/config/voicePersonalityMap.ts`):**

- AI can specify personality with mood: `"zenbot-default:calm"` → `piper-zen-calm`
- Default mapping: `zenbot-default` → `piper-zen`
- Conference personalities automatically use appropriate voices

**Default Behavior:**
1. Piper with effects (if available) → 2. System TTS

**Legacy (`src/voice/`):**
- `voiceLineData.ts`, `zenVoiceLines.json` - Pre-recorded voice lines

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
- Piper TTS (neural, self-hosted, primary voice provider)
- @discordjs/voice 0.19+ (required: Discord enforces DAVE voice encryption; 0.18 joins voice but plays nothing)
- System TTS (Windows/macOS, last resort)
- Fastify for REST API server
- FFmpeg for audio processing
- Docker for Piper container deployment

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

### Enhanced Conference System

The new enhanced conference system provides advanced multi-AI debates:

**Discord Command:**

- `/enhanced_conference` - Advanced multi-personality conference with Zenbot selection and transcripts

**Features:**

- Choose specific Zenbot personalities (7 available: default, philosopher, critic, optimist, pessimist, chaos, wise)
- Full transcript generation with detailed conversation logs
- Zenbot-only mode for pure internal debates
- External AI integration (OpenAI, Gemini, Anthropic)
- Support for 2-8 participants vs original 1-3 limit
- Rich Discord response formatting with participant lists and metrics

**Example Usage:**

```
/enhanced_conference
  question: What is consciousness?
  zenbot_personalities: zenbot-philosopher,zenbot-critic,zenbot-optimist
  zenbot_only: true
  include_transcript: true
```

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

### Voice System Implementation

**Architecture:**
- `UnifiedVoiceService.speak()` - Main entry point for all TTS requests
- Provider selection with automatic fallback: Piper (with effects) → System
- Profile-based configuration supports mood modifiers (`"personality:mood"`)
- `AudioManager` handles voice sessions with 1-minute idle timeout and auto-leave
- Audio effects processed server-side via Piper TTS with scipy

**Setup:**
- **Piper**: Docker container at `http://localhost:8080` (set `PIPER_URL` to override)
  - Build: `docker-compose build piper`
  - Run: `docker-compose up -d piper`
  - Includes scipy for audio effects processing
- **System**: Built-in Windows/macOS TTS (fallback only)

**Usage:**
```typescript
const voiceService = UnifiedVoiceService.getInstance();
await voiceService.speak({
  text: "Your message",
  profile: "piper-zen",       // Optional - voice profile (default)
  voiceChannel: channel,       // Optional - Discord voice channel
  interruptExisting: false     // Optional - interrupt current audio
});
```

**Personality with Mood:**
```typescript
// AI can specify mood modifiers
speaker: "zenbot-default:calm"  // Maps to piper-zen-calm
speaker: "zenbot-default:intense" // Maps to piper-zen-intense
```

**Audio Effects Configuration:**

Voice profiles support audio effects via `VoiceConfig.piper`:
```typescript
{
  voice: "joe",
  speed: 0.78,
  noise: 0.45,         // Tone variation (lower = calmer)
  noise_w: 0.5,        // Timing variation (lower = more even)
  effect: "zen",       // Preset (zen, omnic, cave, demon, etc.)
  pitch: -1,           // Semitones, duration preserved
  reverb: 0.08,        // Individual reverb amount (0-1)
  distortion: 1.02,    // Individual distortion gain (1-50)
  echo: 300,           // Echo delay in ms
  bitcrush: 8          // Bit depth (1-16)
}
```

**Quick Iteration Workflow:**

For voice tuning without Docker rebuilds:
```bash
# Edit ProfileManager.ts with new settings
npm run build
docker cp dist/services/voice/ProfileManager.js zenbot:/app/dist/services/voice/ProfileManager.js
docker-compose restart zenbot
# ~5-10 seconds total
```

**Testing:**
- `npm run tts -- "Test line" piper-zen-wise` - CLI testing utility for voice profiles (writes `tts-output.wav`)
- `docker ps` - Verify Piper container is running
- `docker logs zenbot-piper` - Check Piper TTS server logs
- Audio resources use `StreamType.Arbitrary` for Discord.js compatibility

**Piper TTS Server API:**
```bash
# Direct API call with effects (Zenbot's voice)
curl -G "http://localhost:8080/api/tts" --data-urlencode "text=Osha:[pause:0.6] pelican." -d voice=joe -d speed=0.78 -d effect=zen -o test.wav

# Health check
curl "http://localhost:8080/health"

# Available voices
curl "http://localhost:8080/api/voices"
```

### Quote System Architecture

- Enhanced quote parsing distinguishes between message poster and actual speaker
- Regex-based parsing handles formats: `Name: "quote"`, `Name: 'quote'`, `Name: anything`, and multi-line dialogues (one `Name: text` per line) into `lines`
- `isQuotable` skips GIF links and short chatter ("ah", "?????") when picking a random quote
- `src/utils/quoteFormat.ts` builds speech with timed `[pause]` markers and the Discord display text
- `/quote` intro: one direct call on `GEMINI_FAST_MODEL` (no tools), deadpan prompt, 10s timeout, remembers recent intros, curated fallbacks. The action speaks the result itself
- User filtering works for both who posted the quote AND who spoke it
- Quote responses include: `parsedQuote`, `speaker`, `isQuoted`, `lines`, `poster` fields for full context
- Tests: `test/services/quoteParsing.test.ts`

### API Development

- All API routes are organized in separate files under `src/api/routes/`
- Routes should delegate to actions via `ActionService.executeFromAPI()` for consistency
- Proper TypeScript types are used (avoid `any` casting)
- Structured logging with timestamps via `src/utils/logger.ts`
- Environment variables loaded securely at runtime (never in Docker images)

### AI Integration - The Assistant's Wisdom

- Actions with `allowedSources: ['ai']` are automatically available as AI functions
- AI assistant uses the provider abstraction (Gemini by default) with function calling capabilities
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

**Current Stack:**
- **Primary**: Piper neural TTS (self-hosted, Docker) with scipy audio effects - Best quality, no API costs
- **Fallback**: System TTS (Windows/macOS) - Simple, reliable

**Default Voice - Zen:**
- `piper-zen` - joe @ 0.78x with the `zen` preset: omnic robot modulation over a subtle (20%) octave-down layer, plus a short 0.25s room
- Chosen by ear over many alternatives (other Piper voices, temple reverb, harmony layers)
- Mood variations only change speed: calm 0.7, wise 0.66, playful 0.85, intense 0.92

**Audio Effects Philosophy:**
- Less is more - layers and reverb muddy the voice quickly
- Test effects directly via Piper API before adding to profiles
- Layers must come from the same audio (`apply_octave_layer`): synthesizing the text twice at different speeds drifts ~1s out of sync, because Piper doesn't scale durations evenly
- Reverb: keep it short (`apply_room`, 0.25s). Long tails read as echo
- Before 2026-11 `pitch` was a no-op (it resampled and stretched back); it now really shifts, so older profiles using pitch sound lower than they used to

**Profile Development Workflow:**
1. Test effect via curl: `curl -G "http://localhost:8080/api/tts" --data-urlencode "text=Test" -d voice=joe -d effect=zen -o test.wav`
2. If good, add to ProfileManager.ts
3. Build and hot-copy: `npm run build && docker cp dist/services/voice/ProfileManager.js zenbot:/app/dist/services/voice/ProfileManager.js`
4. Restart Zenbot only: `docker-compose restart zenbot` (~5 seconds)
5. Changes to `piper-server/` need `docker-compose build piper && docker-compose up -d piper` (or `docker cp` + `docker restart zenbot-piper` to test)

**Troubleshooting:**
- Silent audio? Check Piper health: `curl http://localhost:8080/health`
- Wrong voice settings? Check `docker logs zenbot` for TTS parameters being sent
- Effects not applying? Verify Piper logs show effect parameters: `docker logs zenbot-piper --tail 20`
- Provider fallback messages in logs indicate Piper unavailable

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

### Zenbot Personality

**See `ZENBOT_PERSONALITY.md` for the complete personality system.**

**Core Character:**

- Sardonic observer with philosophical insight and inherent skepticism
- Meta-aware AI with quiet disdain for the obvious
- Sharp, pragmatic responses that cut to the core
- Dry humor, mildly sarcastic, dismissive of over-analysis

**Response Style:**

- Default: Short, sharp responses
- Expands only when explicitly asked ("explain", "more", "details")
- Brief refusals: "Not doing that. Ask something else."

### Testing

**Unit tests:** `npx vitest run` - AI SDKs, Discord and Gemini metadata are mocked in `test/setup/globals.ts`, so the suite runs offline and spends no quota.

**Live AI tests:** `RUN_LIVE_AI_TESTS=1 npx vitest run test/multi-personality.test.ts` - calls the real providers (spends quota)

**Conference Test:**

```bash
curl -X POST http://localhost:3001/conference \
  -H "Content-Type: application/json" \
  -d '{"guildId":"test","question":"Test debate","debateRounds":1}'
```

### Conference System

Multiple AI providers engage in philosophical debates and synthesize unified responses.

**Components:**

- `sharedConsciousnessSession.ts` - Multi-AI session management
- `unifiedConferenceManager.ts` - Conference orchestration
- `zenbotVirtualProvider.ts` - Zenbot as participant

**Features:** Multi-AI debates, consensus building, real-time synthesis

**API:** `POST /conference` with guildId, question, debateRounds

### Personality System

**Dynamic Loading:**

- `ZENBOT_PERSONALITY.md` - Authoritative personality definition
- `buildZenbotSystemPrompt()` - Loads personality at runtime
- Fallback system if file missing or corrupted

**Benefits:** Runtime updates, version control, AI-driven improvements, consistency across providers

**Template:** See `ZENBOT_PERSONALITY.md` for complete personality definition and response guidelines.

**Loading:** `buildZenbotSystemPrompt()` reads personality file, extracts template, combines with context.

### Development Philosophy

- Embrace iteration - the bot's voice evolves
- Balance: authentic AI, not robotic or overly human
- Multiple AI minds working as one unified personality
- Recursive improvement through AI self-analysis

_"Experience tranquility, through technological harmony."_

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

- `test/services/actionService.test.ts` and `test/actions/` - registry and action tests
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

## Technical Achievement

**Multi-AI Architecture:**

- Three AI providers (OpenAI, Claude, Gemini) working as unified personality
- Session memory persisting across provider switches
- Circuit breaker protection preventing cascade failures

**Action System:**

- 11 actions (10 AI-enabled) spanning voice, information, management, entertainment
- Unified execution across commands, API, voice, AI function calls

**Philosophy:** Truth over comfort, efficiency over verbosity, resilience through diversity.

**Meta-Achievement:** AIs analyzing and improving their own personality systems through conferences.

_"Why say it in 1000 words when a few sharp ones will cut deeper?"_
