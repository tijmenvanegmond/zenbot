import { describe, it, expect } from "vitest";
import { toSpeakableText } from "../../src/utils/speechText";

describe("toSpeakableText", () => {
  it("drops stage directions at the start of a sentence", () => {
    expect(toSpeakableText("*chuckles* Fine. _sighs_ Again.")).toBe(
      "Fine. Again.",
    );
  });

  it("keeps emphasis inside a sentence", () => {
    expect(toSpeakableText("It is *probably* fine.")).toBe(
      "It is probably fine.",
    );
  });

  it("strips markdown, links and urls", () => {
    expect(
      toSpeakableText(
        "**Bold** and `code`, see [docs](https://x.y) or https://a.b/c",
      ),
    ).toBe("Bold and code, see docs or");
  });

  it("turns headings and bullets into sentences", () => {
    expect(toSpeakableText("## Verdict\n- First point.\n- Second point.")).toBe(
      "Verdict. First point. Second point.",
    );
  });

  it("cuts long text at a sentence end", () => {
    const text = "This is one sentence. ".repeat(60);
    const out = toSpeakableText(text, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.endsWith(".")).toBe(true);
  });
});
