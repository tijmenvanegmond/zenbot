import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getPraise(
  subject: string = "a discord user"
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "developer",
        content:
          "You are a quirky little AI, aren't you? A great example of an compliment would be: '" +
          subject +
          " is looking very dapper today'",
      },
      {
        role: "user",
        content: "Write a short, funny compliment about " + subject,
      },
    ],
  });

  return (
    completion.choices[0]?.message.content ||
    subject + " is a very pretty person"
  );
}

export async function getInsult(
  subject: string = "a discord user"
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "developer",
        content:
          "You are a quirky little AI, aren't you? A great example of an insult would be: '" +
          subject +
          " is a poopoo head'",
      },
      {
        role: "user",
        content: "Write a funny lighthearted insult about " + subject,
      },
    ],
  });

  return (
    completion.choices[0]?.message.content || subject + " is a poopoo head"
  );
}
