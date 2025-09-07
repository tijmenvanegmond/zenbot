import { describe, it, expect, vi } from "vitest";

// We need to actually import the original module for these tests
vi.mock("@discordjs/voice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@discordjs/voice")>();
  return {
    ...actual,
    // Keep all original functionality for dependency tests
  };
});

describe("Discord Voice Dependencies", () => {
  it("should have @discordjs/voice available", async () => {
    // This tests that the voice dependency is properly installed and can be imported
    const voiceModule = await import("@discordjs/voice");
    
    expect(voiceModule).toBeDefined();
    expect(voiceModule.generateDependencyReport).toBeDefined();
    expect(typeof voiceModule.generateDependencyReport).toBe("function");
  });

  it("should generate dependency report without errors", async () => {
    const { generateDependencyReport } = await import("@discordjs/voice");
    
    expect(() => {
      const report = generateDependencyReport();
      expect(typeof report).toBe("string");
      expect(report.length).toBeGreaterThan(0);
    }).not.toThrow();
  });

  it("should have required voice components available", async () => {
    const voiceModule = await import("@discordjs/voice");
    
    // Check for essential voice components
    expect(voiceModule.joinVoiceChannel).toBeDefined();
    expect(voiceModule.createAudioPlayer).toBeDefined();
    expect(voiceModule.createAudioResource).toBeDefined();
    expect(voiceModule.AudioPlayerStatus).toBeDefined();
    expect(voiceModule.VoiceConnectionStatus).toBeDefined();
  });

  it("should have proper type definitions", async () => {
    const voiceModule = await import("@discordjs/voice");
    
    // These should be function constructors
    expect(typeof voiceModule.joinVoiceChannel).toBe("function");
    expect(typeof voiceModule.createAudioPlayer).toBe("function");
    expect(typeof voiceModule.createAudioResource).toBe("function");
    
    // These should be enum objects
    expect(typeof voiceModule.AudioPlayerStatus).toBe("object");
    expect(typeof voiceModule.VoiceConnectionStatus).toBe("object");
  });
});