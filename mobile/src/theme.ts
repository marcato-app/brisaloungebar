// Mesma paleta do PDV web (pdv.html): ferramenta de operação, não vitrine —
// paleta fria e dura, dourado só onde importa, números em monoespaçada.
// Manter os dois lados iguais é de propósito: quem troca de aparelho no meio
// do turno não pode sentir que mudou de sistema.

export const colors = {
  gold: '#ffb400',
  goldLight: '#ffcc33',
  black: '#0a0c0f',
  blackSoft: '#14171c',
  card: '#181c22',
  card2: '#1e242c',
  border: '#2b313a',
  borderSoft: '#21262e',
  text: '#eef1f5',
  textDim: '#8b93a1',
  danger: '#ff5252',
  ok: '#22c55e',
  novo: '#3b82f6',
  producao: '#ffb400',
  aguardando: '#a855f7',
  entregue: '#22c55e',
  teal: '#2dd4bf',
  orange: '#fb923c',
  pink: '#f472b6',
} as const;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Monoespaçada pra número (preço, mesa, quantidade) — no PDV web isso é IBM
// Plex Mono; aqui usa a monoespaçada do próprio sistema, que já vem instalada
// e não custa download nenhum numa wifi de bar ruim.
export const mono = { ios: 'Menlo', android: 'monospace', default: 'monospace' } as const;

// Cor de cada status do item, igual às colunas do quadro de setor.
export const statusColor: Record<string, string> = {
  pendente: colors.novo,
  preparando: colors.producao,
  pronto: colors.aguardando,
  entregue: colors.entregue,
  cancelado: colors.danger,
};

export const roleLabel: Record<string, string> = {
  gerente: 'Gerente',
  caixa: 'Caixa',
  garcom: 'Garçom',
};

export const sectorLabel: Record<string, string> = {
  bar_cozinha: 'Bar/Cozinha',
  tabacaria: 'Tabacaria',
};
