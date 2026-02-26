export type RoomPageResult<T> = {
  items: T[];
  hasMore: boolean;
  nextOffset: number;
};

export type InfiniteScrollState = {
  requestedOffsets: Set<number>;
};

export function paginateRooms<T>(rooms: T[], offset: number, limit: number): RoomPageResult<T> {
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);

  const items = rooms.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + items.length;

  return {
    items,
    hasMore: nextOffset < rooms.length,
    nextOffset,
  };
}

export function createInfiniteScrollState(): InfiniteScrollState {
  return {
    requestedOffsets: new Set(),
  };
}

export function shouldStopInfiniteScroll(
  state: InfiniteScrollState,
  currentOffset: number,
  pageHasMore: boolean,
): boolean {
  if (!pageHasMore) {
    return true;
  }

  if (state.requestedOffsets.has(currentOffset)) {
    return true;
  }

  state.requestedOffsets.add(currentOffset);
  return false;
}
