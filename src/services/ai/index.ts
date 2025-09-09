/**
 * AI Services - Unified Interface
 * Entry point for all AI functionality with swappable providers and session management
 */

export * from './types';
export * from './baseProvider';
export * from './aiServiceManager';
export * from './providers/openaiProvider';
export * from './providers/anthropicProvider';
export * from './storage/memoryStorage';

// Re-export for convenience
export { DefaultAIServiceManager as AIServiceManager } from './aiServiceManager';