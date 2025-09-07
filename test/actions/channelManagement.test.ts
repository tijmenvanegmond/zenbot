import { describe, it, expect, beforeEach } from "vitest";
import { ChannelManagementAction } from "../../src/actions/management/channelManagementAction";
import { ActionContext } from "../../src/actions/actionTypes";

describe("ChannelManagementAction", () => {
  let action: ChannelManagementAction;

  beforeEach(() => {
    action = new ChannelManagementAction();
  });

  describe("Action Properties", () => {
    it("should have correct metadata", () => {
      expect(action.name).toBe("channel_management");
      expect(action.category).toBe("utility");
      expect(action.description).toContain("channel");
    });

    it("should have valid schema", () => {
      expect(action.schema.name).toBe("channel_management");
      expect(action.schema.description).toBeDefined();
      expect(action.schema.parameters).toBeDefined();
      expect(action.schema.parameters.type).toBe("object");
    });
  });

  describe("Parameter Validation", () => {
    it("should validate correct suggest_name parameters", () => {
      const validParams = { action: "suggest_name", name_style: "zen" };
      expect(action.validate(validParams)).toBe(true);
    });

    it("should reject invalid action", () => {
      const invalidAction = { action: "invalid_action" };
      expect(action.validate(invalidAction)).toBe(false);
    });

    it("should reject invalid style", () => {
      const invalidStyle = {
        action: "suggest_name",
        name_style: "invalid_style",
      };
      expect(action.validate(invalidStyle)).toBe(false);
    });

    it("should reject rename without channel_id", () => {
      const missingChannelId = { action: "rename" };
      expect(action.validate(missingChannelId)).toBe(false);
    });

    it("should validate all supported actions", () => {
      const supportedActions = ["rename", "suggest_name", "analyze", "create"];

      supportedActions.forEach((actionType) => {
        const params =
          actionType === "rename"
            ? { action: actionType, channel_id: "123", new_name: "Test" }
            : { action: actionType };

        if (actionType === "suggest_name") {
          params.name_style = "zen";
        }

        expect(action.validate(params)).toBe(true);
      });
    });

    it("should validate all supported styles", () => {
      const supportedStyles = [
        "creative",
        "descriptive",
        "zen",
        "playful",
        "epic",
      ];

      supportedStyles.forEach((style) => {
        const params = { action: "suggest_name", name_style: style };
        expect(action.validate(params)).toBe(true);
      });
    });
  });

  describe("Mock Execution", () => {
    it("should handle suggest_name action", async () => {
      const mockContext: ActionContext = {
        guild: { id: "test-guild", name: "Test Guild" },
        user: { id: "test-user", username: "TestUser" },
        isVoiceInteraction: false,
        source: "command",
      };

      const result = await action.execute(mockContext, {
        action: "suggest_name",
        name_style: "zen",
      });

      // Should return a result structure
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("shouldRespond");

      // For suggest_name without real Discord context, should handle gracefully
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.shouldRespond).toBe("boolean");

      if (result.error) {
        expect(typeof result.error).toBe("string");
      }

      if (result.responseText) {
        expect(typeof result.responseText).toBe("string");
      }
    });

    it("should handle different action types", async () => {
      const mockContext: ActionContext = {
        guild: { id: "test-guild", name: "Test Guild" },
        user: { id: "test-user", username: "TestUser" },
        isVoiceInteraction: false,
        source: "command",
      };

      const actionTypes = ["suggest_name", "analyze", "create"];

      for (const actionType of actionTypes) {
        const params =
          actionType === "suggest_name"
            ? { action: actionType, name_style: "zen" }
            : { action: actionType };

        const result = await action.execute(mockContext, params);

        expect(result).toHaveProperty("success");
        expect(result).toHaveProperty("shouldRespond");
        expect(typeof result.success).toBe("boolean");
      }
    });
  });

  describe("Schema Structure", () => {
    it("should have required schema properties", () => {
      const schema = action.schema;

      expect(schema.parameters.properties).toHaveProperty("action");
      expect(schema.parameters.properties.action.enum).toContain(
        "suggest_name",
      );
      expect(schema.parameters.properties.action.enum).toContain("rename");
      expect(schema.parameters.properties.action.enum).toContain("analyze");
      expect(schema.parameters.properties.action.enum).toContain("create");

      expect(schema.parameters.required).toContain("action");
    });

    it("should define style options for suggest_name", () => {
      const schema = action.schema;

      expect(schema.parameters.properties).toHaveProperty("name_style");
      expect(schema.parameters.properties.name_style.enum).toContain("zen");
      expect(schema.parameters.properties.name_style.enum).toContain(
        "creative",
      );
      expect(schema.parameters.properties.name_style.enum).toContain(
        "descriptive",
      );
    });
  });
});
