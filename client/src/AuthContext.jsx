import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // user: null = unknown/guest, { username } = logged in
  // status: 'loading' | 'ready'
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  // Restore session from httpOnly cookie on mount
  useEffect(() => {
    api.me()
      .then((data) => setUser({ username: data.username }))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'));
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setUser({ username: data.username });
    return data;
  }, []);

  const signup = useCallback(async (username, password) => {
    const data = await api.signup(username, password);
    setUser({ username: data.username });
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
