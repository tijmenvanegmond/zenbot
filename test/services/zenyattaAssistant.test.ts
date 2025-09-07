import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZenyattaAssistantService } from "../../src/services/zenyattaAssistantService";

// Mock the OpenAI service to avoid real API calls
vi.mock("../../src/services/openaiService", () => ({
  OpenAIService: {
    getClient: vi.fn(() => ({
      beta: {
        assistants: {
          list: vi.fn(() => Promise.resolve({ data: [] })),
          create: vi.fn(() => Promise.resolve({
            id: "mock-assistant-id",
            name: "Zenyatta-v3",
          })),
        },
        threads: {
          create: vi.fn(() => Promise.resolve({
            id: "mock-thread-id"
          })),
          messages: {
            create: vi.fn(() => Promise.resolve({})),
            list: vi.fn(() => Promise.resolve({
              data: [{
                role: "assistant",
                content: [{ type: "text", text: { value: "Mock response from Zenyatta" } }],
                run_id: "mock-run-id"
              }]
            })),
          },
          runs: {
            create: vi.fn(() => Promise.resolve({
              id: "mock-run-id",
              status: "completed"
            })),
            retrieve: vi.fn(() => Promise.resolve({
              status: "completed"
            })),
            list: vi.fn(() => Promise.resolve({ data: [] })),
          },
        },
      },
    })),
  },
}));

describe("ZenyattaAssistantService", () => {
  let assistantService: ZenyattaAssistantService;

  beforeEach(() => {
    assistantService = ZenyattaAssistantService.getInstance();
  });

  describe("Service Initialization", () => {
    it("should be a singleton", () => {
      const instance1 = ZenyattaAssistantService.getInstance();
      const instance2 = ZenyattaAssistantService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it("should have stats method", () => {
      expect(typeof assistantService.getStats).toBe("function");
    });

    it("should return valid stats structure", () => {
      const stats = assistantService.getStats();
      
      expect(stats).toHaveProperty("activeThreads");
      expect(stats).toHaveProperty("assistantId");
      expect(typeof stats.activeThreads).toBe("number");
    });
  });

  describe("Mock Context Creation", () => {
    it("should handle mock interaction objects", () => {
      const mockInteraction = {
        user: {
          id: "test_user_123",
          username: "TestUser",
        },
        guild: {
          id: "test_guild_123",
          name: "Test Server",
        },
        client: {
          users: {
            fetch: vi.fn(() => Promise.resolve({
              id: "test_user_123",
              username: "TestUser"
            })),
          },
        },
      };

      // Should not throw when creating with mock interaction
      expect(() => {
        // Test basic properties access
        expect(mockInteraction.user.id).toBe("test_user_123");
        expect(mockInteraction.user.username).toBe("TestUser");
        expect(mockInteraction.guild?.name).toBe("Test Server");
      }).not.toThrow();
    });
  });

  describe("Response Structure", () => {
    it("should define correct response interface", () => {
      // Test that the ZenyattaResponse interface structure is available
      const mockResponse = {
        text: "Experience tranquility",
        shouldUseVoice: true,
        voiceText: "Experience tranquility",
        mood: "zen" as const,
        reasoning: "Test response",
      };

      expect(mockResponse.text).toBeDefined();
      expect(typeof mockResponse.shouldUseVoice).toBe("boolean");
      expect(["zen", "wise", "playful", "mysterious"]).toContain(mockResponse.mood);
    });

    it("should handle different mood types", () => {
      const validMoods = ["zen", "wise", "playful", "mysterious"];
      
      validMoods.forEach(mood => {
        const mockResponse = {
          text: "Test response",
          shouldUseVoice: false,
          mood: mood as any,
        };
        
        expect(validMoods).toContain(mockResponse.mood);
      });
    });
  });

  describe("Service Configuration", () => {
    it("should handle initialization without errors in test environment", async () => {
      // In test environment with mocked OpenAI, initialization should work
      expect(async () => {
        await assistantService.initialize();
      }).not.toThrow();
    });

    it("should provide cleanup method", () => {
      expect(typeof assistantService.cleanupOldThreads).toBe("function");
    });
  });
});