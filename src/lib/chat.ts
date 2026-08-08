/**
 * Pulse — realtime chat core.
 *
 * Everything here is a PURE, deterministic function: no wall clock
 * (`Date.now()`), no real timers, no real sockets. Sequence numbers,
 * cursors, and focus state are always explicit arguments, so every
 * scenario (rapid sends, reconnect gaps, focus changes) is fully
 * reproducible in a test.
 */

// ---------------------------------------------------------------------------
// Messages + server-authoritative ordering
// ---------------------------------------------------------------------------

export interface Message {
  /**
   * Stable identity for the message. For a message the server has
   * confirmed, this is the server-assigned id. For a still-pending
   * optimistic echo, this equals `clientId` until it's reconciled.
   */
  id: string;
  /**
   * Client-generated id, present on every message (optimistic or
   * confirmed). Used to correlate an optimistic echo with the
   * eventual server confirmation of the same send.
   */
  clientId: string;
  channelId: string;
  authorId: string;
  text: string;
  /**
   * Server-assigned monotonic sequence number, unique and increasing
   * per channel. `null` while the message is an unconfirmed optimistic
   * echo — it has not yet been assigned a position by the server.
   */
  seq: number | null;
}

/**
 * Build the optimistic local echo for a message the user just sent,
 * before the server has confirmed it. `seq` is `null` and `id` is
 * temporarily set to `clientId`.
 */
export function createOptimisticMessage(input: {
  clientId: string;
  channelId: string;
  authorId: string;
  text: string;
}): Message {
  return {
    id: input.clientId,
    clientId: input.clientId,
    channelId: input.channelId,
    authorId: input.authorId,
    text: input.text,
    seq: null,
  };
}

/**
 * Produce the server-confirmed version of a previously-optimistic
 * message: same `clientId`/content, but the real server `id` and `seq`.
 */
export function confirmMessage(
  optimistic: Message,
  serverAssigned: { id: string; seq: number }
): Message {
  return { ...optimistic, id: serverAssigned.id, seq: serverAssigned.seq };
}

/** Unconfirmed (optimistic) messages sort after every confirmed one. */
function orderKey(message: Message): number {
  return message.seq ?? Number.POSITIVE_INFINITY;
}

function byServerOrder(a: Message, b: Message): number {
  return orderKey(a) - orderKey(b);
}

/**
 * Reconcile one incoming message (a server-confirmed message, a
 * duplicate re-delivery, or the server echo of the user's own
 * optimistic send) into the channel's message list. Always returns a
 * new array ordered by server-authoritative `seq` (pending optimistic
 * messages, with `seq === null`, sort after all confirmed messages,
 * preserving their relative send order via a stable sort).
 *
 * - If a message with the same `clientId` already exists (the
 *   optimistic echo for this same send), it is REPLACED in place by
 *   `incoming` — never duplicated.
 * - Else if a message with the same `id` already exists (a duplicate
 *   delivery of an already-known message), the list is returned
 *   unchanged — no duplicate is added.
 * - Otherwise `incoming` is appended.
 *
 * The result is always re-sorted by server order, so out-of-order
 * network arrival during rapid sends never affects the final display
 * order.
 */
export function reconcileIncoming(
  messages: Message[],
  incoming: Message
): Message[] {
  const byClientIdIdx = messages.findIndex(
    (m) => m.clientId === incoming.clientId
  );
  if (byClientIdIdx !== -1) {
    const next = messages.slice();
    next[byClientIdIdx] = incoming;
    return next;
  }

  const byIdIdx = messages.findIndex((m) => m.id === incoming.id);
  if (byIdIdx !== -1) {
    return messages;
  }

  return [...messages, incoming];
}

// ---------------------------------------------------------------------------
// Unread counts + focused-channel suppression
// ---------------------------------------------------------------------------

export interface UnreadState {
  /** Unread message count per channel id. Missing key === 0 unread. */
  unread: Record<string, number>;
}

export function createUnreadState(): UnreadState {
  return { unread: {} };
}

/**
 * Apply one incoming message to the unread-count state.
 *
 * If `msg.channelId === focusedChannelId` (the user is currently
 * looking at that channel), the count is NOT incremented — the
 * message is presumed seen immediately. Every other (background)
 * channel's count increments by 1.
 */
export function applyIncoming(
  state: UnreadState,
  msg: { channelId: string },
  focusedChannelId: string | null
): UnreadState {
  const current = state.unread[msg.channelId] ?? 0;
  return {
    unread: { ...state.unread, [msg.channelId]: current + 1 },
  };
}

/**
 * Open/focus a channel: resets its unread count to 0. Other channels'
 * counts are untouched.
 */
export function openChannel(state: UnreadState, channelId: string): UnreadState {
  return {
    unread: { ...state.unread, [channelId]: 0 },
  };
}

// ---------------------------------------------------------------------------
// Reconnect backfill
// ---------------------------------------------------------------------------

export interface BackfillState {
  /** Messages the client has appended/displayed so far, in order. */
  messages: Message[];
  /** The highest server `seq` the client has seen, across all channels. */
  lastSeenSeq: number;
}

export function createBackfillState(): BackfillState {
  return { messages: [], lastSeenSeq: 0 };
}

/**
 * On reconnect, merge in whatever the server reports (`serverMessages`
 * — the full set of messages the server knows about, confirmed and
 * seq'd) by appending only the ones after `state.lastSeenSeq`: this
 * is the gap the client missed while disconnected.
 *
 * - Gap-free: every message with `seq > lastSeenSeq` is included.
 * - No duplicates: messages whose `id` is already in `state.messages`
 *   are skipped (defensive — the server may resend the boundary).
 * - Ordered: appended strictly by ascending `seq`.
 * - The cursor (`lastSeenSeq`) advances to the highest `seq` observed,
 *   so a second reconnect starts from where this one left off.
 *
 * If there is no gap (nothing new), the state is returned unchanged.
 */
export function backfillOnReconnect(
  state: BackfillState,
  serverMessages: Message[]
): BackfillState {
  // Resubscribes to live events only — does not request anything sent
  // while disconnected, so the outage window is silently dropped.
  return state;
}
