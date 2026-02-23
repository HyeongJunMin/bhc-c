export type ShotLifecycleState = 'idle' | 'running' | 'resolved';
export type ShotLifecycleEvent = 'SHOT_SUBMITTED' | 'SHOT_RESOLVED' | 'TURN_CHANGED';

export function transitionShotLifecycleState(
  current: ShotLifecycleState,
  event: ShotLifecycleEvent,
): ShotLifecycleState | null {
  if (current === 'idle' && event === 'SHOT_SUBMITTED') {
    return 'running';
  }
  if (current === 'running' && event === 'SHOT_RESOLVED') {
    return 'resolved';
  }
  if (current === 'resolved' && event === 'TURN_CHANGED') {
    return 'idle';
  }
  return null;
}

