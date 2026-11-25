import { describe, it, expect } from "vitest";
import {
  LeaveVoiceAction,
  takePendingLeave,
} from "../../src/actions/voice/leaveVoiceAction";

const contextIn = (voiceChannelId: string | null) =>
  ({
    guild: { id: "g1", name: "Guild" },
    user: { id: "u1", username: "tester" },
    source: "ai",
    interaction: {
      guild: { members: { me: { voice: { channelId: voiceChannelId } } } },
    },
  }) as any;

describe("leave_voice", () => {
  it("marks the guild to leave after the reply, once", async () => {
    const result = await new LeaveVoiceAction().execute(contextIn("vc"), {});
    expect(result.success).toBe(true);
    expect(takePendingLeave("g1")).toBe(true);
    expect(takePendingLeave("g1")).toBe(false);
  });

  it("refuses when Zenbot isn't in voice", async () => {
    const result = await new LeaveVoiceAction().execute(contextIn(null), {});
    expect(result.success).toBe(false);
    expect(takePendingLeave("g1")).toBe(false);
  });
});
