import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { AUTH_STATE_CHANGED_EVENT, authApi } from '../services/api';
import { AuthContext } from './auth-context';

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('accessToken');
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedUser = localStorage.getItem('user');

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());

  useEffect(() => {
    const syncAuthState = () => {
      setToken(getStoredToken());
      setUser(getStoredUser());
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);
    window.addEventListener('storage', syncAuthState);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncAuthState);
      window.removeEventListener('storage', syncAuthState);
    };
  }, []);

  const persistUser = (nextUser: User) => {
    localStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);

    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    persistUser(response.data.user);

    setToken(response.data.accessToken);
  };

  const register = async (email: string, password: string, name?: string) => {
    const response = await authApi.register(email, password, name);

    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    persistUser(response.data.user);

    setToken(response.data.accessToken);
  };

  const refreshProfile = async () => {
    const response = await authApi.getCurrentUser();
    persistUser(response.data);
  };

  const updateProfile = async (payload: {
    name?: string;
    phone_number?: string;
    call_consent?: boolean;
    call_opt_out?: boolean;
  }) => {
    const response = await authApi.updateCurrentUser(payload);
    persistUser(response.data);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        isLoading: false,
        login,
        register,
        refreshProfile,
        updateProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
