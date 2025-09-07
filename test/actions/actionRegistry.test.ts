import { describe, it, expect, beforeEach } from "vitest";
import { ZenActionRegistry } from "../../src/actions/actionRegistry";
import {
  ActionContext,
  ActionParameters,
  ZenAction,
} from "../../src/actions/actionTypes";

// Mock action for testing
class TestAction implements ZenAction {
  name = "test_action";
  description = "A test action for unit testing";
  category = "utility" as const;

  schema = {
    name: "test_action",
    description: "Test action",
    parameters: {
      type: "object" as const,
      properties: {
        message: {
          type: "string" as const,
          description: "Test message",
        },
      },
      required: ["message"],
    },
  };

  async execute(context: ActionContext, parameters: ActionParameters) {
    return {
      success: true,
      message: `Test executed with: ${parameters.message}`,
      shouldRespond: true,
      responseText: `Test response: ${parameters.message}`,
    };
  }

  validate(parameters: ActionParameters): boolean {
    return typeof parameters.message === "string";
  }
}

describe("ZenActionRegistry", () => {
  let registry: ZenActionRegistry;
  let testAction: TestAction;

  beforeEach(() => {
    registry = new ZenActionRegistry();
    testAction = new TestAction();
  });

  it("should register an action", () => {
    registry.register(testAction);

    const retrieved = registry.get("test_action");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("test_action");
  });

  it("should get all actions", () => {
    registry.register(testAction);

    const all = registry.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("test_action");
  });

  it("should get actions by category", () => {
    registry.register(testAction);

    const utilityActions = registry.getByCategory("utility");
    expect(utilityActions).toHaveLength(1);
    expect(utilityActions[0].name).toBe("test_action");
  });

  it("should get AI-enabled actions", () => {
    registry.register(testAction);

    const aiActions = registry.getForAI();
    expect(aiActions).toHaveLength(1);
    expect(aiActions[0].name).toBe("test_action");
  });

  it("should execute an action", async () => {
    registry.register(testAction);

    const context: ActionContext = {
      user: { id: "test-user", username: "testuser" },
      isVoiceInteraction: false,
      source: "command",
    };

    const parameters = { message: "Hello World" };

    const result = await registry.execute("test_action", context, parameters);

    expect(result.success).toBe(true);
    expect(result.message).toBe("Test executed with: Hello World");
    expect(result.responseText).toBe("Test response: Hello World");
  });

  it("should validate action parameters", async () => {
    registry.register(testAction);

    const context: ActionContext = {
      user: { id: "test-user", username: "testuser" },
      isVoiceInteraction: false,
      source: "command",
    };

    // Invalid parameters (missing message)
    await expect(registry.execute("test_action", context, {})).rejects.toThrow(
      "Invalid parameters",
    );
  });

  it("should throw error for non-existent action", async () => {
    const context: ActionContext = {
      user: { id: "test-user", username: "testuser" },
      isVoiceInteraction: false,
      source: "command",
    };

    await expect(registry.execute("non_existent", context, {})).rejects.toThrow(
      "Action 'non_existent' not found",
    );
  });

  it("should get registry statistics", () => {
    registry.register(testAction);

    const stats = registry.getStats();

    expect(stats.total).toBe(1);
    expect(stats.byCategory.utility).toBe(1);
    expect(stats.aiEnabled).toBe(1);
  });
});
