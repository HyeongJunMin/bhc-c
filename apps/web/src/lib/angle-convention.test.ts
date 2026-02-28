import { describe, expect, it } from 'vitest';
import {
  clientToServerShotDirectionDeg,
  serverToClientShotDirectionDeg,
  normalizeShotDirectionDeg,
} from './angle-convention';

describe('angle convention mapping', () => {
  it('maps client principal axes to server axes', () => {
    expect(clientToServerShotDirectionDeg(0)).toBe(90);
    expect(clientToServerShotDirectionDeg(90)).toBe(0);
    expect(clientToServerShotDirectionDeg(180)).toBe(270);
    expect(clientToServerShotDirectionDeg(270)).toBe(180);
  });

  it('round-trips between client and server conventions', () => {
    const samples = [0, 15, 45, 90, 123, 180, 271, 359];
    for (const sample of samples) {
      const roundTrip = serverToClientShotDirectionDeg(clientToServerShotDirectionDeg(sample));
      expect(roundTrip).toBe(normalizeShotDirectionDeg(sample));
    }
  });
});
