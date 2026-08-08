import { expect, test } from "vitest";
import { createUnreadState, applyIncoming, openChannel } from "@/lib/chat";

test("a message arriving in the currently focused channel does not increment its unread count", () => {
  let state = createUnreadState();
  state = applyIncoming(state, { channelId: "general" }, "general");
  state = applyIncoming(state, { channelId: "general" }, "general");

  expect(state.unread.general ?? 0).toBe(0);
});

test("opening a channel resets its unread count to 0", () => {
  let state = createUnreadState();
  // Messages arrive while "general" is a background channel (some other
  // channel is focused).
  state = applyIncoming(state, { channelId: "general" }, "random");
  state = applyIncoming(state, { channelId: "general" }, "random");
  expect(state.unread.general).toBe(2);

  state = openChannel(state, "general");
  expect(state.unread.general).toBe(0);
});

test("background (non-focused) channels still accumulate unread count", () => {
  let state = createUnreadState();
  state = applyIncoming(state, { channelId: "general" }, "random");
  state = applyIncoming(state, { channelId: "design" }, "random");
  state = applyIncoming(state, { channelId: "general" }, "random");

  expect(state.unread.general).toBe(2);
  expect(state.unread.design).toBe(1);
  // The focused channel itself never accumulated anything.
  expect(state.unread.random ?? 0).toBe(0);
});

test("a message in the focused channel does not increment even after other channels have unread", () => {
  let state = createUnreadState();
  state = applyIncoming(state, { channelId: "design" }, "general");
  state = applyIncoming(state, { channelId: "general" }, "general");

  expect(state.unread.design).toBe(1);
  expect(state.unread.general ?? 0).toBe(0);
});
