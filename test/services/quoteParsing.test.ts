import { describe, it, expect } from "vitest";
import { parseQuote, isQuotable } from "../../src/services/quoteService";
import {
  formatQuoteForSpeech,
  formatQuoteForDisplay,
} from "../../src/utils/quoteFormat";
import { getCuratedRemark } from "../../src/voice/curatedRemarks";
import { EnrichedQuote } from "../../src/types";

// Formats below mirror what people actually post in the quotes channel
const enrich = (content: string): EnrichedQuote => {
  const parsed = parseQuote(content);
  return {
    id: "1",
    content,
    parsedQuote: parsed.quote,
    speaker: parsed.speaker,
    isQuoted: parsed.isQuoted,
    lines: parsed.lines,
    poster: { id: "p", username: "poster", displayName: "Poster" },
    timestamp: new Date(0).toISOString(),
    url: "https://discord.com/channels/1/2/3",
  };
};

describe("parseQuote", () => {
  it('parses Name: "quote"', () => {
    const q = parseQuote('osha:" the kettle is judging me"');
    expect(q).toMatchObject({
      speaker: "osha",
      quote: "the kettle is judging me",
      isQuoted: true,
    });
  });

  it("parses an unquoted Name: text", () => {
    const q = parseQuote("drago: I thought Tuesday was Thursday");
    expect(q.speaker).toBe("drago");
    expect(q.quote).toBe("I thought Tuesday was Thursday");
  });

  it("handles a space before the colon and curly quotes", () => {
    const q = parseQuote("Erik : “that's not a bird”");
    expect(q.speaker).toBe("Erik");
    expect(q.quote).toBe("that's not a bird");
  });

  it("keeps multi-word speakers like 'erik to nemjit'", () => {
    const q = parseQuote('erik to nemjit:" is that legal?"');
    expect(q.speaker).toBe("erik to nemjit");
  });

  it("splits a multi-line dialogue into speaker lines", () => {
    const q = parseQuote(
      'Osha :"pelican" \nMurloc:" those are seagulls Brother" \nOsha:" Chicken.."',
    );
    expect(q.isQuoted).toBe(true);
    expect(q.speaker).toBe("Osha & Murloc");
    expect(q.lines).toEqual([
      { speaker: "Osha", text: "pelican" },
      { speaker: "Murloc", text: "those are seagulls Brother" },
      { speaker: "Osha", text: "Chicken.." },
    ]);
  });

  it("keeps context lines in a dialogue as narration", () => {
    const q = parseQuote('(during ranked)\nphoenix:" who has the payload?"');
    expect(q.lines[0]).toEqual({ speaker: null, text: "(during ranked)" });
    expect(q.lines[1].speaker).toBe("phoenix");
  });

  it("does not treat a URL scheme as a speaker", () => {
    const q = parseQuote("https://klipy.com/gifs/some-cat-gif");
    expect(q.speaker).toBeNull();
    expect(q.isQuoted).toBe(false);
  });

  it("does not treat a long sentence with a colon as a speaker", () => {
    const q = parseQuote("so the plan for tonight was simple: nobody dies");
    expect(q.speaker).toBeNull();
  });
});

describe("isQuotable", () => {
  it.each(["ah", "?????", "yeah…", "Dolphins", "https://klipy.com/gifs/x"])(
    "skips chatter and links: %s",
    (content) => {
      expect(isQuotable(enrich(content))).toBe(false);
    },
  );

  it.each([
    'osha:" ok"',
    "drago: I thought Tuesday was Thursday",
    "(i was explaining the rules and nobody listened)",
  ])("keeps real quotes: %s", (content) => {
    expect(isQuotable(enrich(content))).toBe(true);
  });
});

describe("formatQuoteForSpeech", () => {
  it("adds a pause after the speaker", () => {
    expect(
      formatQuoteForSpeech(enrich('osha:" the kettle is judging me"')),
    ).toBe("osha:[pause:0.6] the kettle is judging me.");
  });

  it("pauses between dialogue lines and keeps existing punctuation", () => {
    const speech = formatQuoteForSpeech(
      enrich(
        'Osha :"pelican"\nMurloc:" those are seagulls Brother"\nOsha:" Chicken.."',
      ),
    );
    expect(speech).toBe(
      "Osha:[pause:0.6] pelican.[pause:0.9] " +
        "Murloc:[pause:0.6] those are seagulls Brother.[pause:0.9] " +
        "Osha:[pause:0.6] Chicken..",
    );
  });

  it("reads narration without a speaker label", () => {
    expect(formatQuoteForSpeech(enrich("(nobody listened)"))).toBe(
      "(nobody listened).",
    );
  });
});

describe("formatQuoteForDisplay", () => {
  it("shows each line as a blockquote with the poster", () => {
    const display = formatQuoteForDisplay(
      enrich('Osha:"pelican"\nMurloc:"seagulls"'),
      "quotes",
    );
    expect(display).toBe(
      "💬 **From #quotes** (shared by Poster)\n" +
        "> **Osha:** pelican\n" +
        "> **Murloc:** seagulls",
    );
  });
});

describe("getCuratedRemark", () => {
  it("fills in the subject's name", () => {
    const remark = getCuratedRemark("sarcastic", "osha");
    expect(remark).toContain("osha");
    expect(remark).not.toContain("{name}");
  });

  it("falls back to positive remarks for unknown types", () => {
    expect(getCuratedRemark("nonexistent", "drago")).toContain("drago");
  });
});

describe("quote filter by every name", () => {
  // Just enough of a Discord channel for fetchAndParseQuotes
  const channelWith = (contents: string[]) => {
    class FakeCollection extends Map<string, any> {
      filter(fn: (m: any) => boolean) {
        return new FakeCollection([...this].filter(([, m]) => fn(m)));
      }
    }
    const messages = new FakeCollection(
      contents.map((content, i) => [
        String(i),
        {
          id: String(i),
          content,
          author: { id: "poster", username: "murloc", displayName: "Murloc" },
          createdAt: new Date(),
          url: "",
        },
      ]),
    );
    return { messages: { fetch: async () => messages } } as any;
  };

  it("matches speakers by any of their names, as whole words", async () => {
    const { fetchAndParseQuotes } = await import(
      "../../src/services/quoteService"
    );
    const channel = channelWith([
      'nem: "I meant to do that"',
      'The worst of us: "trust me"',
      'Nemesis: "not him"',
      'osha: "pelican"',
    ]);
    const { quotes } = await fetchAndParseQuotes(channel, {
      names: ["Nem", "The worst of us", "nemjit"],
    });
    expect(quotes.map((q) => q.parsedQuote).sort()).toEqual([
      "I meant to do that",
      "trust me",
    ]);
  });
});
