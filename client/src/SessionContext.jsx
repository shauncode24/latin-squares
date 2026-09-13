import { createContext, useCallback, useContext, useState } from 'react';
import { api } from './api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [activeSession, setActiveSession] = useState(null);
  const [sessionAttempts, setSessionAttempts] = useState([]);

  const startSession = useCallback(async (mode, difficulty, questionCount) => {
    const data = await api.createSession(mode, difficulty, questionCount);
    setActiveSession(data);
    setSessionAttempts([]);
    return data;
  }, []);

  const recordAttempt = useCallback((attempt) => {
    setSessionAttempts((prev) => [...prev, attempt]);
  }, []);

  const endSession = useCallback(async () => {
    if (!activeSession) return null;
    const data = await api.completeSession(activeSession.sessionId);
    setActiveSession(null);
    setSessionAttempts([]);
    return data;
  }, [activeSession]);

  return (
    <SessionContext.Provider value={{ activeSession, sessionAttempts, startSession, recordAttempt, endSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
