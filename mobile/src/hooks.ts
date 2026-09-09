import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { api, ApiError } from './api';

interface UseApiResult<T> {
  data: T | null;
  error: string | null;
  /** Só no primeiro carregamento — o refresh do polling não pisca a tela. */
  loading: boolean;
  reload: () => void;
}

/**
 * Busca um endpoint e (opcionalmente) fica atualizando sozinho.
 *
 * Duas decisões que importam na prática:
 *  - o polling só roda com a tela em foco; quadro de setor atualizando de
 *    fundo em três telas ao mesmo tempo é bateria do garçom indo embora.
 *  - refresh de polling não liga `loading` de novo, senão a tela pisca a
 *    cada 6 segundos e ninguém consegue tocar em nada.
 */
export function useApi<T>(path: string | null, options: { pollMs?: number } = {}): UseApiResult<T> {
  const { pollMs } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const firstLoadDone = useRef(false);

  const fetchOnce = useCallback(async (signal?: AbortSignal) => {
    if (!path) return;
    try {
      const out = await api<T>(path, { signal });
      if (signal?.aborted) return;
      setData(out);
      setError(null);
    } catch (err) {
      if (signal?.aborted || (err as Error)?.name === 'AbortError') return;
      // 401 já derruba a sessão pelo handler global; não vale poluir a tela
      // com "não autorizado" enquanto o app volta pro login.
      if (err instanceof ApiError && err.status === 401) return;
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      if (!signal?.aborted) {
        firstLoadDone.current = true;
        setLoading(false);
      }
    }
  }, [path]);

  const reload = useCallback(() => {
    if (!firstLoadDone.current) setLoading(true);
    void fetchOnce();
  }, [fetchOnce]);

  useEffect(() => {
    if (!path || !isFocused) return;
    const ctrl = new AbortController();
    void fetchOnce(ctrl.signal);
    if (!pollMs) return () => ctrl.abort();
    const id = setInterval(() => { void fetchOnce(); }, pollMs);
    return () => { ctrl.abort(); clearInterval(id); };
  }, [path, isFocused, pollMs, fetchOnce]);

  return { data, error, loading, reload };
}

/**
 * Envolve uma ação que fala com a API (lançar item, pagar, cancelar): trava
 * o botão enquanto roda e devolve o erro pra tela mostrar. Sem isso, dois
 * toques rápidos no mesmo botão viram dois lançamentos na comanda.
 */
export function useAction(): {
  run: (fn: () => Promise<unknown>, onDone?: () => void) => Promise<void>;
  busy: boolean;
  error: string | null;
  clearError: () => void;
} {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<unknown>, onDone?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { run, busy, error, clearError: () => setError(null) };
}
