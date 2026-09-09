import { API_URL } from './config';

/**
 * Erro que carrega o status HTTP junto. As telas precisam distinguir "deu
 * ruim" de "sua sessão caiu" (401) e de "você não tem permissão" (403) —
 * com um Error solto não dá.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Chamado quando a API responde 401 em qualquer rota — a sessão expirou ou
 * foi derrubada de outro aparelho. Quem registra é o SessionProvider, que
 * então joga o usuário de volta pro login em vez de deixar a tela travada
 * num erro que não passa.
 */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Não dispara o logout automático no 401 — usado só pelo próprio login. */
  skipAuthHandler?: boolean;
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers.Authorization = 'Bearer ' + authToken;

  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch (err) {
    // Falha de rede não tem status HTTP nenhum: wifi do bar caiu, servidor
    // fora do ar, DNS. Mensagem em português porque ela aparece na tela.
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('Sem conexão com o servidor. Confira a internet.', 0);
  }

  if (res.status === 401 && !opts.skipAuthHandler) {
    onUnauthorized?.();
  }

  // 204 e afins não têm corpo; tentar ler JSON aí explodiria à toa.
  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
      ? data.error
      : 'Erro ' + res.status;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
