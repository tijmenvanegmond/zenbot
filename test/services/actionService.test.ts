import { describe, it, expect, beforeEach } from "vitest";
import { ActionService } from "../../src/services/actionService";

describe("ActionService", () => {
  let actionService: ActionService;

  beforeEach(() => {
    actionService = ActionService.getInstance();
  });

  describe("Registry Management", () => {
    it("should initialize with core actions", () => {
      const registry = actionService.getRegistry();
      const stats = registry.getStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byCategory).toBeDefined();
      expect(stats.aiEnabled).toBeGreaterThan(0);
    });

    it("should have expected action categories", () => {
      const registry = actionService.getRegistry();
      const stats = registry.getStats();

      // Should have multiple categories
      const expectedCategories = [
        "voice",
        "information",
        "utility",
        "admin",
        "entertainment",
      ];
      const actualCategories = Object.keys(stats.byCategory);

      expectedCategories.forEach((category) => {
        expect(actualCategories).toContain(category);
      });
    });

    it("should register channel management action", () => {
      const registry = actionService.getRegistry();
      const channelAction = registry.get("channel_management");

      expect(channelAction).toBeDefined();
      expect(channelAction?.name).toBe("channel_management");
      expect(channelAction?.category).toBe("utility");
      expect(channelAction?.description).toContain("channel");
    });

    it("should have actions available for AI", () => {
      const registry = actionService.getRegistry();
      const aiActions = registry.getForAI();

      expect(aiActions.length).toBeGreaterThan(0);

      // Channel management should be AI-enabled
      const channelSchema = aiActions.find(
        (schema) => schema.name === "channel_management",
      );
      expect(channelSchema).toBeDefined();
    });

    it("should list actions by category correctly", () => {
      const registry = actionService.getRegistry();

      // Voice actions
      const voiceActions = registry.getByCategory("voice");
      expect(voiceActions.length).toBeGreaterThan(0);
      expect(voiceActions.every((action) => action.category === "voice")).toBe(
        true,
      );

      // Information actions
      const infoActions = registry.getByCategory("information");
      expect(infoActions.length).toBeGreaterThan(0);
      expect(
        infoActions.every((action) => action.category === "information"),
      ).toBe(true);
    });

    it("should provide function schemas for OpenAI", () => {
      const schemas = actionService.getFunctionSchemas();

      expect(Array.isArray(schemas)).toBe(true);
      expect(schemas.length).toBeGreaterThan(0);

      // Each schema should have correct structure
      schemas.forEach((schema) => {
        expect(schema).toHaveProperty("type", "function");
        expect(schema.function).toHaveProperty("name");
        expect(schema.function).toHaveProperty("description");
        expect(schema.function).toHaveProperty("parameters");
      });
    });
  });

  describe("Action Statistics", () => {
    it("should return comprehensive stats", () => {
      const stats = actionService.getStats();

      expect(stats).toHaveProperty("total");
      expect(stats).toHaveProperty("byCategory");
      expect(stats).toHaveProperty("aiEnabled");

      expect(typeof stats.total).toBe("number");
      expect(typeof stats.byCategory).toBe("object");
      expect(typeof stats.aiEnabled).toBe("number");

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.aiEnabled).toBeGreaterThan(0);
    });

    it("should have expected minimum number of actions", () => {
      const stats = actionService.getStats();

      // Should have at least the core actions we know about
      expect(stats.total).toBeGreaterThanOrEqual(10);
      expect(stats.aiEnabled).toBeGreaterThanOrEqual(9);
    });
  });
});
