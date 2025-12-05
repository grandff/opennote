/**
 * 인증 상태 관리 스토어
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 사용자 정보 타입
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// 인증 상태 타입
type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  // 상태
  user: User | null;
  status: AuthStatus;
  error: string | null;
  
  // 액션
  setUser: (user: User | null) => void;
  setStatus: (status: AuthStatus) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  reset: () => void;
}

const initialState = {
  user: null,
  status: 'idle' as AuthStatus,
  error: null,
};

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,

      setUser: (user) => set({ 
        user, 
        status: user ? 'authenticated' : 'unauthenticated',
        error: null,
      }),

      setStatus: (status) => set({ status }),

      setError: (error) => set({ error, status: 'unauthenticated' }),

      logout: () => set({ 
        user: null, 
        status: 'unauthenticated',
        error: null,
      }),

      reset: () => set(initialState),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);

export default useAuthStore;

