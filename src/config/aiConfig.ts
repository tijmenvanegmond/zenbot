/**
 * AI Service Configuration
 * Central configuration for all AI providers and settings
 */

import { AIServiceConfig } from '../services/ai';
import { logger } from '../utils/logger';

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// Validate required API keys
if (!OPENAI_API_KEY) {
  logger.warn('⚠️ OPENAI_API_KEY not found - OpenAI provider will be disabled');
}

if (!ANTHROPIC_API_KEY) {
  logger.warn('⚠️ ANTHROPIC_API_KEY not found - Anthropic provider will be disabled');
}

if (!GOOGLE_AI_API_KEY) {
  logger.warn('⚠️ GOOGLE_AI_API_KEY not found - Gemini provider will be disabled');
}

if (!OPENAI_API_KEY && !ANTHROPIC_API_KEY && !GOOGLE_AI_API_KEY) {
  throw new Error('At least one AI provider API key must be configured (OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY)');
}

// Determine default provider based on available keys
const getDefaultProvider = (): string => {
  if (OPENAI_API_KEY) return 'openai';
  if (ANTHROPIC_API_KEY) return 'anthropic'; 
  if (GOOGLE_AI_API_KEY) return 'gemini';
  throw new Error('No AI provider available');
};

export const AI_CONFIG: AIServiceConfig = {
  defaultProvider: getDefaultProvider(),
  
  // Provider-specific configurations
  providers: {
    ...(OPENAI_API_KEY && {
      openai: {
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o-mini',
        maxTokens: 1000,
        temperature: 0.7
      }
    }),
    
    ...(ANTHROPIC_API_KEY && {
      anthropic: {
        apiKey: ANTHROPIC_API_KEY,
        defaultModel: 'claude-3-5-haiku-20241022',
        maxTokens: 1000,
        temperature: 0.7
      }
    }),
    
    ...(GOOGLE_AI_API_KEY && {
      gemini: {
        apiKey: GOOGLE_AI_API_KEY,
        defaultModel: 'gemini-1.5-flash',
        maxTokens: 1000,
        temperature: 0.7
      }
    })
  },

  // Session management settings
  session: {
    defaultExpiry: 1440, // 24 hours in minutes
    maxMessages: 100,    // Max messages per session for Zenyatta
    cleanupInterval: 30, // Cleanup every 30 minutes
    storage: 'memory'    // Use memory storage for now
  },

  // Provider routing for different capabilities
  routing: {
    simple: OPENAI_API_KEY ? 'openai' : (ANTHROPIC_API_KEY ? 'anthropic' : 'gemini'),      // Simple text generation
    conversation: OPENAI_API_KEY ? 'openai' : (ANTHROPIC_API_KEY ? 'anthropic' : 'gemini'), // Conversations with memory  
    functions: OPENAI_API_KEY ? 'openai' : (ANTHROPIC_API_KEY ? 'anthropic' : 'gemini'),    // Function calling
    streaming: OPENAI_API_KEY ? 'openai' : (ANTHROPIC_API_KEY ? 'anthropic' : 'gemini')     // Streaming responses
  },

  // Fallback configuration - safe linear chains
  fallbacks: {
    providers: {
      openai: ['anthropic', 'gemini'],      // OpenAI → Anthropic → Gemini
      anthropic: ['openai', 'gemini'],      // Anthropic → OpenAI → Gemini  
      gemini: ['openai', 'anthropic']       // Gemini → OpenAI → Anthropic
    },
    maxRetries: 2,
    circuitBreakerThreshold: 3
  }
};

export const ZENYATTA_CONFIG = {
  // Character-specific settings
  character: {
    name: 'Zenyatta',
    sessionExpiry: 1440,    // 24 hours for character consistency
    maxHistory: 100,        // More history for character continuity
    temperature: 0.8,       // Slightly more creative for personality
    enableFunctions: true   // Allow function calling
  },

  // TTS settings
  tts: {
    model: 'gpt-4o-mini-tts',
    voice: 'echo',
    format: 'mp3',
    instructions: 'Speak in a calm, wise, and serene tone like Zenyatta from Overwatch - an omnic monk with a deep, resonant, slightly robotic voice. Add subtle pauses between phrases for contemplation. Be philosophical and peaceful.'
  },

  // Remark generation settings
  remarks: {
    useSessionMemory: true,  // Use conversation history for context
    fallbackToStatic: true,  // Fall back to static responses if AI fails
    maxLength: 200          // Keep remarks concise
  }
};

logger.info(`🤖 AI Config loaded with provider: ${AI_CONFIG.defaultProvider}`);
logger.info(`🧘 Zenyatta configured with session expiry: ${ZENYATTA_CONFIG.character.sessionExpiry} minutes`);