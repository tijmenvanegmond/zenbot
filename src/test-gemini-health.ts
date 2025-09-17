/**
 * Quick Gemini Health Check Test
 */

import "dotenv/config";
import { GeminiProvider } from "./services/ai/providers/geminiProvider";
import { MemorySessionStorage } from "./services/ai/storage/memoryStorage";

async function testGeminiHealth() {
  console.log("🔍 Testing Gemini Provider Health...");
  
  if (!process.env.GOOGLE_AI_API_KEY) {
    console.log("❌ No GOOGLE_AI_API_KEY found");
    return;
  }
  
  console.log(`✅ API Key found: ${process.env.GOOGLE_AI_API_KEY.substring(0, 8)}...`);
  
  try {
    const storage = new MemorySessionStorage();
    const provider = new GeminiProvider(storage, {
      apiKey: process.env.GOOGLE_AI_API_KEY,
      defaultModel: "gemini-1.5-flash", // Try the stable model
    });
    
    console.log("🤖 Provider created successfully");
    console.log(`📋 Supported models: ${provider.supportedModels.join(", ")}`);
    
    console.log("🏥 Running health check...");
    try {
      const isHealthy = await provider.healthCheck();
      
      if (isHealthy) {
        console.log("✅ Gemini is healthy!");
        
        // Try a simple generation test
        console.log("💬 Testing simple generation...");
        const response = await provider.generateText("Say 'Hello from Gemini!'");
        console.log(`📝 Response: "${response}"`);
        
      } else {
        console.log("❌ Gemini health check failed");
      }
    } catch (healthError) {
      console.log("💥 Health check threw error:", healthError instanceof Error ? healthError.message : healthError);
    }
    
  } catch (error) {
    console.log("💥 Error testing Gemini:", error instanceof Error ? error.message : error);
  }
}

testGeminiHealth();