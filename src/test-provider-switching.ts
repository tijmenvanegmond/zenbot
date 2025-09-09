/**
 * Test Provider Switching Architecture
 * Demonstrates how the unified system handles multiple providers
 */

import "dotenv/config";
import { AIServiceManager, MemorySessionStorage, OpenAIProvider, AnthropicProvider } from "./services/ai";
import { logger } from "./utils/logger";

async function testProviderArchitecture() {
  try {
    logger.info("🧘 Testing Provider Switching Architecture...");

    // Test 1: Provider Registration and Discovery
    console.log("\n=== Test 1: Provider Registration ===");
    
    const sessionStorage = new MemorySessionStorage();
    
    // Create config for multiple providers
    const config = {
      defaultProvider: 'openai',
      providers: {
        openai: {
          apiKey: process.env.OPENAI_API_KEY || 'test-key',
          defaultModel: 'gpt-4o-mini',
        },
        anthropic: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',  
          defaultModel: 'claude-3-5-haiku-20241022',
        }
      },
      session: {
        defaultExpiry: 1440,
        maxMessages: 100,
        cleanupInterval: 30,
        storage: 'memory' as const
      },
      routing: {
        simple: 'openai',
        conversation: 'openai', 
        functions: 'openai',
        streaming: 'openai'
      }
    };

    const aiManager = new AIServiceManager(config, sessionStorage);
    
    console.log("✅ Registered providers:", Object.keys(config.providers));
    console.log("✅ Default provider:", config.defaultProvider);
    console.log("✅ Routing configuration:", config.routing);

    // Test 2: Provider Capabilities
    console.log("\n=== Test 2: Provider Capabilities ===");
    
    try {
      const openaiProvider = aiManager.getProvider('openai');
      console.log("OpenAI Provider:");
      console.log("  - Models:", openaiProvider.supportedModels);
      console.log("  - Streaming:", openaiProvider.supportsStreaming);
      console.log("  - Functions:", openaiProvider.supportsFunctions);
      console.log("  - Vision:", openaiProvider.supportsVision);
    } catch (error) {
      console.log("❌ OpenAI provider not available:", (error as Error).message);
    }

    try {
      const anthropicProvider = aiManager.getProvider('anthropic');  
      console.log("Anthropic Provider:");
      console.log("  - Models:", anthropicProvider.supportedModels);
      console.log("  - Streaming:", anthropicProvider.supportsStreaming);
      console.log("  - Functions:", anthropicProvider.supportsFunctions);
      console.log("  - Vision:", anthropicProvider.supportsVision);
    } catch (error) {
      console.log("❌ Anthropic provider not available:", (error as Error).message);
    }

    // Test 3: Best Provider Selection
    console.log("\n=== Test 3: Best Provider Selection ===");
    
    try {
      const simpleProvider = aiManager.getBestProvider('simple');
      console.log("Best for simple generation:", simpleProvider.name);
      
      const streamingProvider = aiManager.getBestProvider('streaming');
      console.log("Best for streaming:", streamingProvider.name);
      
      const functionProvider = aiManager.getBestProvider('functions');
      console.log("Best for functions:", functionProvider.name);
    } catch (error) {
      console.log("Provider selection test:", (error as Error).message);
    }

    // Test 4: Session Management
    console.log("\n=== Test 4: Cross-Provider Session Management ===");
    
    try {
      // Create a session with OpenAI
      const session = await aiManager.createSession('Zenyatta', {
        userId: 'test-user',
        systemPrompt: 'You are Zenyatta, the wise omnic monk.',
      });
      
      console.log("✅ Created session:", session.id);
      console.log("  - Provider:", session.metadata.provider);
      console.log("  - Model:", session.metadata.model);
      console.log("  - Character:", session.metadata.character);
      
      // Simulate provider switching by updating session metadata
      await aiManager.getProvider().updateSession(session.id, {
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022'
      });
      
      const updatedSession = await aiManager.getProvider().getSession(session.id);
      console.log("✅ Updated session provider:");
      console.log("  - New Provider:", updatedSession?.metadata.provider);
      console.log("  - New Model:", updatedSession?.metadata.model);
      console.log("  - Messages preserved:", updatedSession?.messages.length);
      
    } catch (error) {
      console.log("Session management test:", (error as Error).message);
    }

    // Test 5: Health Monitoring
    console.log("\n=== Test 5: Provider Health Monitoring ===");
    
    const health = await aiManager.healthCheck();
    console.log("Provider health status:", health);
    
    Object.entries(health).forEach(([provider, isHealthy]) => {
      console.log(`  ${provider}: ${isHealthy ? '✅ Healthy' : '❌ Unavailable'}`);
    });

    // Test 6: Configuration Flexibility  
    console.log("\n=== Test 6: Configuration Examples ===");
    
    console.log("Example configurations for different use cases:");
    
    console.log("\n💰 Cost-Optimized Config:");
    console.log(`{
  defaultProvider: 'openai',
  routing: {
    simple: 'openai',        // Use GPT-4o-mini for simple tasks
    conversation: 'anthropic', // Use Claude Haiku for conversations  
    functions: 'openai',     // Use GPT for function calling
    streaming: 'openai'      // Use GPT for streaming
  }
}`);

    console.log("\n🚀 Performance-Optimized Config:");
    console.log(`{
  defaultProvider: 'anthropic',
  routing: {
    simple: 'anthropic',     // Claude Haiku is very fast
    conversation: 'openai',  // GPT for complex conversations
    functions: 'openai',     // Better function calling
    streaming: 'anthropic'   // Fast streaming responses
  }
}`);

    console.log("\n🛡️ Reliability Config:");
    console.log(`{
  defaultProvider: 'openai',
  fallbacks: {
    openai: ['anthropic'],   // Fall back to Claude if OpenAI fails
    anthropic: ['openai']    // Fall back to OpenAI if Claude fails
  }
}`);

    console.log("✅ Provider architecture test completed!");

  } catch (error) {
    console.error("❌ Architecture test failed:", error);
    process.exit(1);
  }
}

// Run test
testProviderArchitecture();