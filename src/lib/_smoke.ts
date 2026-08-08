import type { Message } from "./chat";

export function ping(): string {
  return "pong";
}

// Minimal static seed data for the facade pages (src/app/*) — not used by
// any test. Keeps the app/ routes real without needing a database or a
// live socket connection.
export const seedMessages: Message[] = [
  {
    id: "m1",
    clientId: "m1",
    channelId: "general",
    authorId: "alice",
    text: "morning team",
    seq: 1,
  },
  {
    id: "m2",
    clientId: "m2",
    channelId: "general",
    authorId: "bob",
    text: "morning!",
    seq: 2,
  },
  {
    id: "m3",
    clientId: "m3",
    channelId: "general",
    authorId: "alice",
    text: "standup in 10",
    seq: 3,
  },
  {
    id: "m4",
    clientId: "m4",
    channelId: "random",
    authorId: "bob",
    text: "anyone free for lunch?",
    seq: 1,
  },
];
