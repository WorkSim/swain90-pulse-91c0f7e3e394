import { expect, test } from "vitest";
import { createBackfillState, backfillOnReconnect, type Message } from "@/lib/chat";

function msg(id: string, seq: number): Message {
  return {
    id,
    clientId: id,
    channelId: "general",
    authorId: "alice",
    text: id,
    seq,
  };
}

test("on reconnect, messages sent during the outage are backfilled", () => {
  let state = createBackfillState();
  state = backfillOnReconnect(state, [msg("s1", 1), msg("s2", 2)]);
  expect(state.messages.map((m) => m.id)).toEqual(["s1", "s2"]);
  expect(state.lastSeenSeq).toBe(2);

  // The client goes offline after seq 2. While it's disconnected, seq 3
  // through 5 are sent by others. On reconnect the server reports its
  // full known set (1 through 6 — 6 having arrived just as we reconnect).
  state = backfillOnReconnect(state, [
    msg("s1", 1),
    msg("s2", 2),
    msg("s3", 3),
    msg("s4", 4),
    msg("s5", 5),
    msg("s6", 6),
  ]);

  // No gap: 3, 4, 5 (sent during the outage) must all be present.
  expect(state.messages.map((m) => m.id)).toEqual([
    "s1",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
  ]);
  expect(state.lastSeenSeq).toBe(6);
});

test("backfill introduces no duplicates when the server re-reports already-seen messages", () => {
  let state = createBackfillState();
  state = backfillOnReconnect(state, [msg("s1", 1), msg("s2", 2), msg("s3", 3)]);

  // Reconnect again; server reports the same messages plus one new one.
  state = backfillOnReconnect(state, [
    msg("s1", 1),
    msg("s2", 2),
    msg("s3", 3),
    msg("s4", 4),
  ]);

  expect(state.messages).toHaveLength(4);
  expect(state.messages.map((m) => m.id)).toEqual(["s1", "s2", "s3", "s4"]);
});

test("message ordering is preserved across the reconnect boundary", () => {
  let state = createBackfillState();
  state = backfillOnReconnect(state, [msg("s1", 1)]);

  // Outage happens; s2 and s3 were sent during it, s4 right after
  // reconnecting. The server reports them out of arrival order to
  // simulate a network race, but seq is authoritative.
  state = backfillOnReconnect(state, [
    msg("s4", 4),
    msg("s2", 2),
    msg("s3", 3),
  ]);

  expect(state.messages.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
});

test("a reconnect with nothing new leaves the state unchanged", () => {
  let state = createBackfillState();
  state = backfillOnReconnect(state, [msg("s1", 1), msg("s2", 2)]);
  const before = state;

  state = backfillOnReconnect(state, [msg("s1", 1), msg("s2", 2)]);

  expect(state.messages).toHaveLength(2);
  expect(state.lastSeenSeq).toBe(2);
  expect(state).toBe(before);
});
