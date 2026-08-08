import { expect, test } from "vitest";
import {
  createOptimisticMessage,
  confirmMessage,
  reconcileIncoming,
  type Message,
} from "@/lib/chat";

test("messages display in server-authoritative order, not arrival order", () => {
  let messages: Message[] = [];

  // Server seq 2 arrives over the network before seq 1 (e.g. its response
  // resolved first under rapid sends) — the reconciled list must still be
  // ordered by seq, not by arrival order.
  messages = reconcileIncoming(messages, {
    id: "s2",
    clientId: "s2",
    channelId: "general",
    authorId: "bob",
    text: "second",
    seq: 2,
  });
  messages = reconcileIncoming(messages, {
    id: "s1",
    clientId: "s1",
    channelId: "general",
    authorId: "alice",
    text: "first",
    seq: 1,
  });
  messages = reconcileIncoming(messages, {
    id: "s3",
    clientId: "s3",
    channelId: "general",
    authorId: "alice",
    text: "third",
    seq: 3,
  });

  expect(messages.map((m) => m.id)).toEqual(["s1", "s2", "s3"]);
  expect(messages.map((m) => m.seq)).toEqual([1, 2, 3]);
});

test("an optimistic echo reconciles to its correct server-assigned position", () => {
  let messages: Message[] = [];

  // Two confirmed messages already in the channel.
  messages = reconcileIncoming(messages, {
    id: "s1",
    clientId: "s1",
    channelId: "general",
    authorId: "alice",
    text: "first",
    seq: 1,
  });
  messages = reconcileIncoming(messages, {
    id: "s2",
    clientId: "s2",
    channelId: "general",
    authorId: "bob",
    text: "second",
    seq: 2,
  });

  // The local user sends a message — it shows up immediately as a pending
  // optimistic echo, ordered after all confirmed messages.
  const optimistic = createOptimisticMessage({
    clientId: "c1",
    channelId: "general",
    authorId: "me",
    text: "my message",
  });
  messages = reconcileIncoming(messages, optimistic);
  expect(messages.map((m) => m.id)).toEqual(["s1", "s2", "c1"]);

  // The server confirms it at seq 3 — but suppose seq 4 (someone else's
  // message) is reconciled first, arriving ahead of our own confirmation.
  messages = reconcileIncoming(messages, {
    id: "s4",
    clientId: "s4",
    channelId: "general",
    authorId: "bob",
    text: "fourth",
    seq: 4,
  });

  const confirmed = confirmMessage(optimistic, { id: "s3", seq: 3 });
  messages = reconcileIncoming(messages, confirmed);

  // Final order must be by seq: 1, 2, 3, 4 — with our message correctly
  // slotted in at position 3, not left at the end where it was appended.
  expect(messages.map((m) => m.id)).toEqual(["s1", "s2", "s3", "s4"]);
  expect(messages.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
});

test("reconciling a confirmed echo never leaves a duplicate entry", () => {
  let messages: Message[] = [];

  const optimistic = createOptimisticMessage({
    clientId: "c1",
    channelId: "general",
    authorId: "me",
    text: "hello",
  });
  messages = reconcileIncoming(messages, optimistic);
  expect(messages).toHaveLength(1);

  const confirmed = confirmMessage(optimistic, { id: "s1", seq: 1 });
  messages = reconcileIncoming(messages, confirmed);

  // Still exactly one entry for this send — not two.
  expect(messages).toHaveLength(1);
  expect(messages[0].id).toBe("s1");
});

test("a duplicate delivery of an already-known message is dropped", () => {
  let messages: Message[] = [];
  const msg: Message = {
    id: "s1",
    clientId: "s1",
    channelId: "general",
    authorId: "alice",
    text: "hi",
    seq: 1,
  };
  messages = reconcileIncoming(messages, msg);
  messages = reconcileIncoming(messages, { ...msg });

  expect(messages).toHaveLength(1);
});
