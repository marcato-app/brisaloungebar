import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, setAuthToken, setUnauthorizedHandler } from './api';
import type { Me, Role } from './types';

const TOKEN_KEY = 'brisa_pdv_token';

interface SessionValue {
  me: Me | null;
  /** true enquanto a gente ainda não sabe se tem sessão salva (splash). */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Atalho pra esconder tela que o cargo não pode ver (a API trava de novo). */
  can: (roles?: Role[]) => boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(async () => {
    setAuthToken(null);
    setMe(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // Keychain indisponível não pode impedir o logout na tela.
    }
  }, []);

  // Sessão salva no Keychain/Keystore: o garçom não loga de novo a cada vez
  // que o app é fechado no meio do turno. Se o token não valer mais, a
  // chamada de /me devolve 401 e a gente simplesmente cai no login.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(TOKEN_KEY);
        if (saved) {
          setAuthToken(saved);
          const who = await api<Me>('/api/pdv/me', { skipAuthHandler: true });
          if (alive) setMe(who);
        }
      } catch {
        setAuthToken(null);
        try { await SecureStore.deleteItemAsync(TOKEN_KEY); } catch {}
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Qualquer 401 no meio do uso derruba a sessão na hora, em vez de deixar
  // a tela repetindo erro sem explicação.
  useEffect(() => {
    setUnauthorizedHandler(() => { void clearSession(); });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const out = await api<{ token: string; name: string; role: Role }>('/api/pdv/login', {
      method: 'POST',
      body: { username: username.trim(), password, issueToken: true },
      skipAuthHandler: true,
    });
    if (!out?.token) throw new ApiError('O servidor não devolveu a sessão. Atualize o app.', 500);
    setAuthToken(out.token);
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, out.token);
    } catch {
      // Sem Keychain o login vale só enquanto o app estiver aberto — melhor
      // que barrar o turno inteiro por causa disso.
    }
    setMe(await api<Me>('/api/pdv/me'));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/api/pdv/logout', { method: 'POST', skipAuthHandler: true });
    } catch {
      // Se o servidor não respondeu, a sessão local sai do mesmo jeito.
    }
    await clearSession();
  }, [clearSession]);

  const can = useCallback((roles?: Role[]) => {
    if (!roles || roles.length === 0) return true;
    return !!me && roles.includes(me.role);
  }, [me]);

  const value = useMemo<SessionValue>(
    () => ({ me, loading, login, logout, can }),
    [me, loading, login, logout, can]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession precisa estar dentro de <SessionProvider>');
  return ctx;
}
