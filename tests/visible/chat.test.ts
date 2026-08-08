import { expect, test } from "vitest";
import {
  createOptimisticMessage,
  confirmMessage,
  reconcileIncoming,
  createUnreadState,
  applyIncoming,
  openChannel,
  createBackfillState,
  backfillOnReconnect,
  type Message,
} from "@/lib/chat";

test("createOptimisticMessage builds a pending echo with seq null", () => {
  const msg = createOptimisticMessage({
    clientId: "c1",
    channelId: "general",
    authorId: "alice",
    text: "hi",
  });
  expect(msg.seq).toBeNull();
  expect(msg.id).toBe("c1");
});

test("reconcileIncoming appends a new confirmed message in order", () => {
  let messages: Message[] = [];
  messages = reconcileIncoming(messages, {
    id: "s1",
    clientId: "s1",
    channelId: "general",
    authorId: "alice",
    text: "hi",
    seq: 1,
  });
  messages = reconcileIncoming(messages, {
    id: "s2",
    clientId: "s2",
    channelId: "general",
    authorId: "bob",
    text: "hey",
    seq: 2,
  });
  expect(messages.map((m) => m.id)).toEqual(["s1", "s2"]);
});

test("reconcileIncoming replaces the optimistic echo with the server confirmation", () => {
  const optimistic = createOptimisticMessage({
    clientId: "c1",
    channelId: "general",
    authorId: "alice",
    text: "hi",
  });
  let messages: Message[] = [optimistic];
  const confirmed = confirmMessage(optimistic, { id: "s1", seq: 1 });
  messages = reconcileIncoming(messages, confirmed);

  expect(messages).toHaveLength(1);
  expect(messages[0].seq).toBe(1);
  expect(messages[0].id).toBe("s1");
});

test("applyIncoming increments unread for a background channel", () => {
  let state = createUnreadState();
  state = applyIncoming(state, { channelId: "random" }, "general");
  expect(state.unread.random).toBe(1);
});

test("openChannel resets unread for that channel", () => {
  let state = createUnreadState();
  state = applyIncoming(state, { channelId: "random" }, "general");
  state = openChannel(state, "random");
  expect(state.unread.random).toBe(0);
});

test("backfillOnReconnect appends the gap and advances the cursor", () => {
  let state = createBackfillState();
  state = backfillOnReconnect(state, [
    { id: "s1", clientId: "s1", channelId: "general", authorId: "alice", text: "a", seq: 1 },
  ]);
  expect(state.lastSeenSeq).toBe(1);

  state = backfillOnReconnect(state, [
    { id: "s1", clientId: "s1", channelId: "general", authorId: "alice", text: "a", seq: 1 },
    { id: "s2", clientId: "s2", channelId: "general", authorId: "bob", text: "b", seq: 2 },
    { id: "s3", clientId: "s3", channelId: "general", authorId: "alice", text: "c", seq: 3 },
  ]);

  expect(state.messages.map((m) => m.id)).toEqual(["s1", "s2", "s3"]);
  expect(state.lastSeenSeq).toBe(3);
});
