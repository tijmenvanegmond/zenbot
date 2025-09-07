import { ActionService } from "./services/actionService";

/**
 * Check if our Channel Management Action is properly registered
 */
async function checkActionRegistry() {
  console.log("🎭 Checking Action Registry...");

  const actionService = ActionService.getInstance();
  const registry = actionService.getRegistry();

  // Get stats
  const stats = registry.getStats();
  console.log("\n📊 Registry Stats:", stats);

  // Check if our action is registered
  const channelAction = registry.get("channel_management");
  if (channelAction) {
    console.log("\n✅ Channel Management Action found!");
    console.log(`• Name: ${channelAction.name}`);
    console.log(`• Category: ${channelAction.category}`);
    console.log(`• Description: ${channelAction.description}`);
  } else {
    console.log("\n❌ Channel Management Action not found in registry");
  }

  // List all actions by category
  console.log("\n📋 Actions by Category:");
  Object.entries(stats.byCategory).forEach(([category, count]) => {
    console.log(`• ${category}: ${count} actions`);
    const actionsInCategory = registry.getByCategory(category);
    actionsInCategory.forEach((action) => {
      console.log(`  - ${action.name}`);
    });
  });

  // Check AI function schemas
  console.log("\n🤖 AI Function Schemas:");
  const aiSchemas = registry.getForAI();
  console.log(`Total AI-enabled actions: ${aiSchemas.length}`);

  const channelSchema = aiSchemas.find(
    (schema) => schema.name === "channel_management",
  );
  if (channelSchema) {
    console.log("✅ Channel Management Action is AI-enabled");
  }
}

checkActionRegistry().catch(console.error);
