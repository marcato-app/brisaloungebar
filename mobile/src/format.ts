/** 2350 -> "R$23,50". A conta do bar é sempre em centavos inteiros; float
 *  em dinheiro fecha caixa errado e ninguém percebe até faltar troco. */
export function formatCents(cents: number): string {
  const v = (cents || 0) / 100;
  return 'R$' + v.toFixed(2).replace('.', ',');
}

/** Minutos desde um timestamp SQLite ("2026-09-09 20:15:00", em UTC). */
export function elapsedMinutes(sqlTimestamp: string | null | undefined): number {
  if (!sqlTimestamp) return 0;
  // O SQLite devolve "YYYY-MM-DD HH:MM:SS" sem fuso; é UTC. Sem o "Z" o
  // iOS interpreta como horário local e a mesa nasce com horas de atraso.
  const iso = sqlTimestamp.includes('T') ? sqlTimestamp : sqlTimestamp.replace(' ', 'T') + 'Z';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 60000));
}

/** 75 -> "1h 15min" */
export function formatElapsed(minutes: number): string {
  if (minutes < 60) return minutes + 'min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h + 'h' + (m ? ' ' + m + 'min' : '');
}

/** Iniciais pro avatar: "Ana Paula Souza" -> "AS" */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** "2026-09-09" -> "09/09/2026" (sem virar objeto Date, que muda de dia por fuso). */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

/** "45,90" ou "45.9" ou "R$ 45,90" -> 4590. Devolve null se não der número —
 *  a tela decide a mensagem, aqui não se inventa valor. */
export function parseCents(text: string): number | null {
  const clean = (text || '').replace(/[^\d,.-]/g, '').replace(',', '.');
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

/** "2026-09-09" é hoje? Compara em texto pra não passar por Date/fuso. */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
