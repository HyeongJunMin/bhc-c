export interface SnapshotBall {
  id: 'cueBall' | 'objectBall1' | 'objectBall2';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  motionState: 'SLIDING' | 'ROLLING' | 'SPINNING' | 'STATIONARY';
  isPocketed: boolean;
}

export interface RoomSnapshot {
  roomId: string;
  seq: number;
  serverTimeMs: number;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  turn: { currentMemberId: string | null; turnDeadlineMs: number | null };
  scoreBoard: Record<string, number>;
  balls: SnapshotBall[];
}

export interface ShotStartedEvent {
  roomId: string;
  playerId: string;
  serverTimeMs: number;
}

export interface ShotResolvedEvent {
  roomId: string;
  shotState: string;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  scoreBoard: Record<string, number>;
  winnerMemberId: string | null;
  serverTimeMs: number;
}

export interface TurnChangedEvent {
  roomId: string;
  currentMemberId: string | null;
  turnDeadlineMs: number | null;
  scoreBoard: Record<string, number>;
  serverTimeMs: number;
}

export interface GameFinishedEvent {
  roomId: string;
  winnerMemberId: string | null;
  memberGameStates: Record<string, string>;
  scoreBoard: Record<string, number>;
  serverTimeMs: number;
}

export interface SseClientHandlers {
  onSnapshot?: (event: RoomSnapshot) => void;
  onShotStarted?: (event: ShotStartedEvent) => void;
  onShotResolved?: (event: ShotResolvedEvent) => void;
  onTurnChanged?: (event: TurnChangedEvent) => void;
  onGameFinished?: (event: GameFinishedEvent) => void;
  onHeartbeat?: (serverTimeMs: number) => void;
  onOpen?: () => void;
  onError?: () => void;
}

function parseEventData<T>(event: MessageEvent<string>): T | null {
  try {
    return JSON.parse(event.data) as T;
  } catch {
    return null;
  }
}

export class SseClient {
  private readonly baseUrl: string;
  private readonly handlers: SseClientHandlers;
  private eventSource: EventSource | null = null;

  constructor(baseUrl: string, handlers: SseClientHandlers = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.handlers = handlers;
  }

  connect(roomId: string, memberId: string): void {
    this.disconnect();
    const url = `${this.baseUrl}/lobby/rooms/${encodeURIComponent(roomId)}/stream?memberId=${encodeURIComponent(memberId)}`;
    const source = new EventSource(url);
    this.eventSource = source;

    source.onopen = () => {
      this.handlers.onOpen?.();
    };
    source.onerror = () => {
      this.handlers.onError?.();
    };
    source.addEventListener('room_snapshot', (event) => {
      const data = parseEventData<RoomSnapshot>(event as MessageEvent<string>);
      if (data) {
        this.handlers.onSnapshot?.(data);
      }
    });
    source.addEventListener('shot_started', (event) => {
      const data = parseEventData<ShotStartedEvent>(event as MessageEvent<string>);
      if (data) {
        this.handlers.onShotStarted?.(data);
      }
    });
    source.addEventListener('shot_resolved', (event) => {
      const data = parseEventData<ShotResolvedEvent>(event as MessageEvent<string>);
      if (data) {
        this.handlers.onShotResolved?.(data);
      }
    });
    source.addEventListener('turn_changed', (event) => {
      const data = parseEventData<TurnChangedEvent>(event as MessageEvent<string>);
      if (data) {
        this.handlers.onTurnChanged?.(data);
      }
    });
    source.addEventListener('game_finished', (event) => {
      const data = parseEventData<GameFinishedEvent>(event as MessageEvent<string>);
      if (data) {
        this.handlers.onGameFinished?.(data);
      }
    });
    source.addEventListener('heartbeat', (event) => {
      const data = parseEventData<{ serverTimeMs: number }>(event as MessageEvent<string>);
      if (data && Number.isFinite(data.serverTimeMs)) {
        this.handlers.onHeartbeat?.(data.serverTimeMs);
      }
    });
  }

  disconnect(): void {
    if (!this.eventSource) {
      return;
    }
    this.eventSource.close();
    this.eventSource = null;
  }
}
