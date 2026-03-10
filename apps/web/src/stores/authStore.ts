import { create } from 'zustand';
import { authGuest } from '../lib/api-client';

const STORAGE_KEY = 'bhc.auth';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  nickname: string | null;
  memberId: string | null;
}

interface AuthStore extends AuthState {
  login: (nickname: string) => Promise<void>;
  logout: () => void;
}

function readFromStorage(): AuthState {
  if (typeof window === 'undefined') {
    return { accessToken: null, refreshToken: null, nickname: null, memberId: null };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { accessToken: null, refreshToken: null, nickname: null, memberId: null };
    }
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return {
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : null,
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : null,
      memberId: typeof parsed.memberId === 'string' ? parsed.memberId : null,
    };
  } catch {
    return { accessToken: null, refreshToken: null, nickname: null, memberId: null };
  }
}

function saveToStorage(state: AuthState): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function clearStorage(): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

const initial = readFromStorage();

export const useAuthStore = create<AuthStore>((set) => ({
  ...initial,

  login: async (nickname: string) => {
    const result = await authGuest(nickname);
    const next: AuthState = {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      nickname: result.nickname,
      memberId: result.guestId,
    };
    saveToStorage(next);
    set(next);
  },

  logout: () => {
    clearStorage();
    set({ accessToken: null, refreshToken: null, nickname: null, memberId: null });
  },
}));
