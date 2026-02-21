export const CHAT_RATE_LIMIT_WINDOW_MS = 3000;

export type UserLastSentAtStore = Map<string, number>;

export function recordLastChatSentAt(
  userLastSentAtStore: UserLastSentAtStore,
  memberId: string,
  sentAtMs: number,
): UserLastSentAtStore {
  userLastSentAtStore.set(memberId, sentAtMs);
  return userLastSentAtStore;
}

export function getLastChatSentAt(userLastSentAtStore: UserLastSentAtStore, memberId: string): number | null {
  return userLastSentAtStore.get(memberId) ?? null;
}
