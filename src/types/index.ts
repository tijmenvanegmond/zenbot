/**
 * Centralized type definitions to avoid duplication across services
 */

// Re-export Discord.js types that we commonly use
export {
  Client,
  Guild,
  TextChannel,
  VoiceChannel,
  GuildMember,
  Message,
  CommandInteraction,
  SlashCommandBuilder,
} from "discord.js";

// Re-export config constants
export { API_CONFIG } from "../config";

// ===== GUILD & CHANNEL TYPES =====
export interface GuildInfo {
  id: string;
  name: string;
  memberCount: number;
  voiceConnections: number;
}

export interface TextChannelInfo {
  id: string;
  name: string;
  topic: string | null;
  nsfw: boolean;
  position: number;
}

export interface VoiceChannelInfo {
  id: string;
  name: string;
  memberCount: number;
  members: MemberInfo[];
}

export interface MemberInfo {
  id: string;
  username: string;
  displayName: string;
}

// ===== BOT STATUS TYPES =====
export interface BotStatus {
  bot: {
    username: string | undefined;
    id: string | undefined;
    uptime: number | null;
    ping: number;
  };
  guilds: GuildInfo[];
  totalGuilds: number;
}

// ===== QUOTE TYPES =====
export interface ParsedQuote {
  speaker: string | null;
  quote: string;
  isQuoted: boolean;
}

export interface EnrichedQuote {
  id: string;
  content: string;
  parsedQuote: string;
  speaker: string | null;
  isQuoted: boolean;
  poster: {
    id: string;
    username: string;
    displayName: string;
  };
  timestamp: string;
  url: string;
}

export interface QuoteSearchOptions {
  limit?: number;
  userId?: string;
  username?: string;
  random?: boolean;
}

export interface QuoteSearchResult {
  quotes: EnrichedQuote[];
  totalFound: number;
}

// ===== VOICE TYPES =====
export interface VoiceLineData {
  text: string;
  voiceUri: string | null;
  length: number;
}

export interface VoiceLineCategories {
  heroSelected: VoiceLineData[];
  setupPhase: VoiceLineData[];
  orbOfHarmony: VoiceLineData[];
  orbOfDiscord: VoiceLineData[];
  transcendence: VoiceLineData[];
  elimination: VoiceLineData[];
  philosophical: VoiceLineData[];
  greetings: VoiceLineData[];
  interactions: {
    genji: VoiceLineData[];
    ramattra: VoiceLineData[];
    symmetra: VoiceLineData[];
  };
  special: VoiceLineData[];
}

export type AdviceContext =
  | "greeting"
  | "philosophical"
  | "harmony"
  | "discord"
  | "transcendence";

// ===== REMARK TYPES =====
export interface RemarkResult {
  text: string;
}

export interface RemarkOptions {
  subject?: string;
  isPositive?: boolean;
}

// ===== COMMAND TYPES =====
export interface CommandResponse {
  success: boolean;
  message: string;
  ephemeral?: boolean;
}

export interface VoiceChannelValidation {
  isValid: boolean;
  member: import("discord.js").GuildMember | null;
  response?: CommandResponse;
}

// ===== API TYPES =====
export interface APIRequestContext {
  guildId: string;
  channelId?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  model?: string;
}

export interface QuoteTTSRequest {
  quoteChannelId: string;
  userId?: string;
  username?: string;
}

// ===== ENVIRONMENT & CONFIG TYPES =====
export interface EnvironmentInfo {
  nodeEnv: string;
  port: number;
  logLevel: string;
  hasDiscordToken: boolean;
  hasOpenAiKey: boolean;
}

// ===== UTILITY TYPES =====
export type Awaitable<T> = T | Promise<T>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// ===== LOG TYPES =====
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}
