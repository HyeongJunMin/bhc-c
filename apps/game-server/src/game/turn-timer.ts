export const TURN_TIMEOUT_MS = 10_000;

export type ScheduleTimeout = (callback: () => void, delayMs: number) => unknown;
export type CancelTimeout = (timerId: unknown) => void;

export type TurnTimer = {
  timeoutMs: number;
  timerId: unknown | null;
  cancel: () => void;
};

const defaultScheduleTimeout: ScheduleTimeout = (callback, delayMs) => setTimeout(callback, delayMs);
const defaultCancelTimeout: CancelTimeout = (timerId) => clearTimeout(timerId as ReturnType<typeof setTimeout>);

export function startTurnTimer(
  onTimeout: () => void,
  timeoutMs: number = TURN_TIMEOUT_MS,
  scheduleTimeout: ScheduleTimeout = defaultScheduleTimeout,
  cancelTimeout: CancelTimeout = defaultCancelTimeout,
): TurnTimer {
  let active = true;

  const timer: TurnTimer = {
    timeoutMs,
    timerId: null,
    cancel: () => {
      if (!active) {
        return;
      }

      active = false;

      if (timer.timerId !== null) {
        cancelTimeout(timer.timerId);
        timer.timerId = null;
      }
    },
  };

  timer.timerId = scheduleTimeout(() => {
    if (!active) {
      return;
    }

    active = false;
    timer.timerId = null;
    onTimeout();
  }, timeoutMs);

  return timer;
}
