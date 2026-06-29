import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: number; username: string } | null;
  login: (token: string) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      login: (token: string) => {
        // Decode JWT to get user info
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          set({ token, user: { id: parseInt(payload.sub), username: payload.username } });
        } catch {
          set({ token, user: null });
        }
      },
      logout: () => set({ token: null, user: null }),
      isLoggedIn: () => !!get().token,
    }),
    {
      name: 'stock-analyst-auth',
    }
  )
);
