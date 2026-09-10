// Espelho dos formatos que a API do PDV devolve (src/index.js no repo raiz).
// Manter isto tipado é o que faz o TypeScript apontar na hora quando a API
// muda de forma — sem isto, o erro só apareceria no celular do garçom.

export type Role = 'garcom' | 'caixa' | 'gerente';

export type ItemStatus = 'pendente' | 'preparando' | 'pronto' | 'entregue' | 'cancelado';

export type Sector = 'bar_cozinha' | 'tabacaria';

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'outro';

export interface Me {
  id: string;
  name: string;
  username: string;
  role: Role;
}

export interface CatalogItem {
  id: string;
  name: string;
  unit?: string;
  priceCents: number;
}

export interface CatalogGroup {
  id: string;
  title: string;
  sector: Sector;
  items: CatalogItem[];
}

export interface CatalogSection {
  id: string;
  title: string;
  groups: CatalogGroup[];
}

export interface TabGuest {
  id: string;
  tab_id: string;
  name: string;
  created_at: string;
}

export interface TabItem {
  id: string;
  tab_id: string;
  item_id: string | null;
  name: string;
  unit_price_cents: number;
  qty: number;
  sector: Sector;
  note: string | null;
  waiter_id: string | null;
  waiter_name: string | null;
  status: ItemStatus;
  printed_at: string | null;
  canceled_by: string | null;
  created_at: string;
  /** null = ainda no carrinho do garçom, a cozinha não viu. */
  sent_at: string | null;
  guest_id: string | null;
  guest_name: string | null;
  paid: boolean;
}

export interface Payment {
  id: string;
  tab_id: string;
  amount_cents: number;
  method: PaymentMethod;
  payer_name: string | null;
  paid_at: string;
  received_by: string | null;
}

/** Comanda como vem na LISTA (`GET /api/pdv/tabs`) — sem itens, com os totais. */
export interface TabSummary {
  id: string;
  label: string;
  customer_id: string | null;
  customer_name: string | null;
  status: 'aberta' | 'fechada';
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  closed_by: string | null;
  table_number: number | null;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  allDelivered: boolean;
}

/** Comanda no DETALHE (`GET /api/pdv/tabs/:id`) — com itens, pessoas e pagamentos. */
export interface TabDetail extends Omit<TabSummary, 'allDelivered'> {
  customer_phone: string | null;
  items: TabItem[];
  guests: TabGuest[];
  payments: Payment[];
}

/** Item na fila de um setor (`GET /api/pdv/sector/:sector`) — carrega o nome da comanda. */
export interface SectorItem extends TabItem {
  tab_label: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
  note: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  username: string;
  role: Role;
  active: number;
  created_at: string;
}

export interface StockItem {
  id: string;
  name: string;
  unit: string | null;
  qty: number;
  min_qty: number | null;
  updated_at: string;
}

export interface Expense {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string | null;
  paid_at: string | null;
  recurring: number;
  category: string | null;
  created_at: string;
}

export interface VenueSettings {
  business_name: string;
  cnpj: string;
  address: string;
  phone: string;
  receipt_footer: string;
}

/** Estado de uma impressora, como `GET /api/pdv/printers` devolve.
 *  `secondsSinceSeen` vem calculado no servidor de propósito: se a tela
 *  fizesse a conta com o relógio do celular, um aparelho com a hora errada
 *  mostraria a impressora morta sem ela estar. */
export interface Printer {
  sector: Sector;
  share: string;
  online: boolean;
  secondsSinceSeen: number | null;
  lastSeenAt: string | null;
  lastPrintedAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  queueCount: number;
}
