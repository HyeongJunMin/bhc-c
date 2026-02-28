function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// Client: 0=+Z, 90=+X
// Server: 0=+X, 90=+Z
export function clientToServerShotDirectionDeg(clientDeg: number): number {
  return normalizeDeg(90 - clientDeg);
}

export function serverToClientShotDirectionDeg(serverDeg: number): number {
  return normalizeDeg(90 - serverDeg);
}

export function normalizeShotDirectionDeg(deg: number): number {
  return normalizeDeg(deg);
}
