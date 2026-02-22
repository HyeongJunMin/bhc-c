export type TurnResolution = {
  scored: boolean;
  shouldSwitchTurn: boolean;
};

export function resolveTurnAfterShot(scored: boolean): TurnResolution {
  return {
    scored,
    shouldSwitchTurn: !scored,
  };
}
