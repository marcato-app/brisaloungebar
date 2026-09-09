import React, { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../session';
import { useApi } from '../hooks';
import { colors, radius, roleLabel, sectorLabel, space } from '../theme';
import type { RootStackParamList, ScreenProps } from '../navigation';
import type { Expense, Sector, SectorItem, StockItem, TabSummary } from '../types';

/** De quanto em quanto tempo o menu recontar o que tem pra olhar. Mais devagar
 *  que as telas de operação: aqui é panorama, não é o movimento em si. */
const HOME_POLL_MS = 15000;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface Fn {
  route: keyof RootStackParamList;
  params?: object;
  icon: IconName;
  accent: string;
  label: string;
  desc: string;
  roles?: string[];
}

// Mesma lista (e mesma trava de cargo) do menu do PDV web. Esconder o bloco
// é só conveniência — a API valida o cargo de novo em toda rota.
const FUNCTIONS: Fn[] = [
  { route: 'Comandas', icon: 'receipt-outline', accent: colors.gold, label: 'Comandas', desc: 'Abrir, lançar pedido e fechar conta' },
  { route: 'Setor', params: { sector: 'bar_cozinha' }, icon: 'flame-outline', accent: colors.novo, label: 'Bar/Cozinha', desc: 'Quadro de preparo' },
  { route: 'Setor', params: { sector: 'tabacaria' }, icon: 'cloud-outline', accent: colors.aguardando, label: 'Tabacaria', desc: 'Quadro de preparo' },
  { route: 'Clientes', icon: 'person-outline', accent: colors.teal, label: 'Clientes', desc: 'Cadastro e busca' },
  { route: 'Estoque', icon: 'cube-outline', accent: colors.orange, label: 'Estoque', desc: 'Contagem manual', roles: ['caixa', 'gerente'] },
  { route: 'Financeiro', icon: 'wallet-outline', accent: colors.ok, label: 'Financeiro', desc: 'Despesas e vencimentos', roles: ['caixa', 'gerente'] },
  { route: 'Funcionarios', icon: 'people-outline', accent: colors.pink, label: 'Funcionários', desc: 'Cadastro da equipe', roles: ['gerente'] },
  { route: 'Configuracoes', icon: 'settings-outline', accent: colors.textDim, label: 'Configurações', desc: 'Dados do negócio no cupom', roles: ['gerente'] },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Boa manhã';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen({ navigation }: ScreenProps<'Home'>) {
  const { me, logout } = useSession();
  const isManager = me?.role === 'gerente';
  const isCashier = me?.role === 'caixa' || isManager;

  const tabs = useApi<{ tabs: TabSummary[] }>('/api/pdv/tabs', { pollMs: HOME_POLL_MS });
  const bar = useApi<{ items: SectorItem[] }>('/api/pdv/sector/bar_cozinha', { pollMs: HOME_POLL_MS });
  const tabacaria = useApi<{ items: SectorItem[] }>('/api/pdv/sector/tabacaria', { pollMs: HOME_POLL_MS });
  const stock = useApi<{ stock: StockItem[] }>(isCashier ? '/api/pdv/stock' : null);
  const expenses = useApi<{ expenses: Expense[] }>(isCashier ? '/api/pdv/expenses?status=aberta' : null);

  const openInSector = (items?: SectorItem[]) =>
    (items || []).filter((i) => i.status !== 'entregue').length;

  const counts: Record<string, { n: number; warn?: boolean }> = {
    Comandas: { n: (tabs.data?.tabs || []).length },
    bar_cozinha: { n: openInSector(bar.data?.items), warn: true },
    tabacaria: { n: openInSector(tabacaria.data?.items), warn: true },
    Estoque: {
      n: (stock.data?.stock || []).filter((s) => s.min_qty != null && s.qty <= s.min_qty).length,
      warn: true,
    },
    Financeiro: { n: (expenses.data?.expenses || []).length },
  };

  // Pronto = a cozinha terminou e ninguém pegou ainda. É a informação que o
  // garçom precisa sem estar olhando o quadro do setor — o copo esquentando
  // no balcão é o custo de não avisar.
  const ready = useMemo(() => {
    const b = (bar.data?.items || []).filter((i) => i.status === 'pronto');
    const t = (tabacaria.data?.items || []).filter((i) => i.status === 'pronto');
    if (!b.length && !t.length) return null;
    const sector: Sector = b.length >= t.length ? 'bar_cozinha' : 'tabacaria';
    return { total: b.length + t.length, sector };
  }, [bar.data, tabacaria.data]);

  const reloadAll = () => {
    tabs.reload(); bar.reload(); tabacaria.reload(); stock.reload(); expenses.reload();
  };
  // A grade é uma lista de dados, então a rota chega como string: o navigate
  // tipado exige o par rota+params casado em tempo de compilação, coisa que
  // uma tabela não tem como provar. O tipo de cada entrada já é conferido no
  // array FUNCTIONS acima.
  const go = navigation.navigate as (route: string, params?: object) => void;
  const visible = FUNCTIONS.filter((f) => !f.roles || (me && f.roles.includes(me.role)));
  const firstName = (me?.name || '').split(' ')[0];

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={reloadAll} tintColor={colors.gold} />}
    >
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>
            {greeting()}, <Text style={s.greetingName}>{firstName}</Text>.
          </Text>
          <Text style={s.role}>{me ? roleLabel[me.role] : ''}</Text>
        </View>
        <Pressable onPress={() => void logout()} hitSlop={10} style={s.logout}>
          <Ionicons name="log-out-outline" size={16} color={colors.textDim} />
          <Text style={s.logoutText}>Sair</Text>
        </Pressable>
      </View>

      {ready ? (
        <Pressable
          onPress={() => navigation.navigate('Setor', { sector: ready.sector })}
          style={({ pressed }) => [s.ready, pressed && { opacity: 0.85 }]}
        >
          <View style={s.readyDot} />
          <Text style={s.readyText}>
            {ready.total === 1 ? '1 pedido pronto pra entregar' : `${ready.total} pedidos prontos pra entregar`}
          </Text>
          <Text style={s.readyWhere}>{sectorLabel[ready.sector]}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.black} />
        </Pressable>
      ) : null}

      <View style={s.grid}>
        {visible.map((f) => {
          const badge = counts[(f.params as { sector?: string } | undefined)?.sector || f.label];
          return (
            <Pressable
              key={f.label}
              style={({ pressed }) => [s.tile, { borderTopColor: f.accent }, pressed && s.tilePressed]}
              onPress={() => go(f.route, f.params)}
            >
              <View style={s.tileTop}>
                <View style={[s.tileIcon, { backgroundColor: f.accent + '22' }]}>
                  <Ionicons name={f.icon} size={20} color={f.accent} />
                </View>
                {badge && badge.n > 0 ? (
                  <View style={[s.badge, badge.warn && { backgroundColor: colors.danger }]}>
                    <Text style={s.badgeText}>{badge.n}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.tileLabel}>{f.label}</Text>
              <Text style={s.tileDesc}>{f.desc}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: space.xxl },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl },
  greeting: { color: colors.text, fontSize: 20, fontWeight: '400' },
  greetingName: { color: colors.goldLight, fontWeight: '700' },
  role: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  logout: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  logoutText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  ready: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.aguardando,
    borderRadius: radius.md,
    paddingVertical: space.md, paddingHorizontal: space.lg,
    marginBottom: space.lg,
  },
  readyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.black },
  readyText: { color: colors.black, fontSize: 14, fontWeight: '700', flex: 1 },
  readyWhere: { color: colors.black, fontSize: 12, opacity: 0.75 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    // Dois por linha em qualquer celular: 48% deixa a folga do gap sem
    // precisar medir a tela.
    width: '48%',
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderTopWidth: 3,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  tilePressed: { opacity: 0.75 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.md },
  tileIcon: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    marginLeft: 'auto',
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  tileLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tileDesc: { color: colors.textDim, fontSize: 12, marginTop: 3, lineHeight: 16 },
});
