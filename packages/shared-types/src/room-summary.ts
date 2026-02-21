import { RoomState } from './room-state.ts';

export type RoomSummary = {
  roomId: string;
  title: string;
  state: RoomState;
  playerCount: number;
  createdAt: string;
};
