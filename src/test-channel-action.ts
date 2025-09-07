import { ChannelManagementAction } from "./actions/management/channelManagementAction";
import { ActionContext } from "./actions/actionTypes";

/**
 * Quick test script for the Channel Management Action
 */
async function testChannelManagementAction() {
  console.log("🧪 Testing Channel Management Action...");

  const action = new ChannelManagementAction();

  // Test validation
  console.log("\n📋 Testing parameter validation:");

  // Valid parameters
  const validParams = { action: "suggest_name", name_style: "zen" };
  console.log(
    `Valid params (${JSON.stringify(validParams)}):`,
    action.validate(validParams),
  );

  // Invalid action
  const invalidAction = { action: "invalid_action" };
  console.log(
    `Invalid action (${JSON.stringify(invalidAction)}):`,
    action.validate(invalidAction),
  );

  // Invalid style
  const invalidStyle = { action: "suggest_name", name_style: "invalid_style" };
  console.log(
    `Invalid style (${JSON.stringify(invalidStyle)}):`,
    action.validate(invalidStyle),
  );

  // Rename without channel_id
  const missingChannelId = { action: "rename" };
  console.log(
    `Rename without channel_id (${JSON.stringify(missingChannelId)}):`,
    action.validate(missingChannelId),
  );

  // Test mock execution (without real Discord context)
  console.log("\n🎭 Testing mock execution:");

  const mockContext: ActionContext = {
    guild: { id: "test-guild", name: "Test Guild" },
    user: { id: "test-user", username: "TestUser" },
    isVoiceInteraction: false,
    source: "command",
  };

  try {
    const result = await action.execute(mockContext, {
      action: "suggest_name",
      name_style: "zen",
    });
    console.log("Mock execution result:", {
      success: result.success,
      error: result.error,
      responseText: result.responseText,
    });
  } catch (error) {
    console.log(
      "Expected error for mock execution:",
      error instanceof Error ? error.message : error,
    );
  }

  console.log("\n✅ Channel Management Action tests completed!");
  console.log("\n📊 Action Summary:");
  console.log(`• Name: ${action.name}`);
  console.log(`• Description: ${action.description}`);
  console.log(`• Category: ${action.category}`);
  console.log(`• Supported actions: rename, suggest_name, analyze, create`);
  console.log(`• Supported styles: creative, descriptive, zen, playful, epic`);
}

// Run the test
testChannelManagementAction().catch(console.error);
