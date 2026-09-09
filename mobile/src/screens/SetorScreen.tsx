import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { POLL_MS } from '../config';
import { useApi, useAction } from '../hooks';
import { elapsedMinutes, formatElapsed } from '../format';
import { EmptyState, ErrorBox, Loading, Mono } from '../ui';
import { colors, radius, sectorLabel, space, statusColor } from '../theme';
import type { ScreenProps } from '../navigation';
import type { ItemStatus, SectorItem } from '../types';

/** As quatro colunas do quadro do PDV web. No celular elas viram abas: quatro
 *  colunas lado a lado num aparelho de 5 polegadas não dá pra ler nem tocar. */
const COLUMNS: { status: ItemStatus; label: string; next?: ItemStatus; nextLabel?: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { status: 'pendente', label: 'Novo', next: 'preparando', nextLabel: 'Começar', icon: 'ellipse-outline' },
  { status: 'preparando', label: 'Preparando', next: 'pronto', nextLabel: 'Pronto', icon: 'flame-outline' },
  { status: 'pronto', label: 'Pronto', next: 'entregue', nextLabel: 'Entregue', icon: 'checkmark-circle-outline' },
  { status: 'entregue', label: 'Entregue', icon: 'archive-outline' },
];

export default function SetorScreen({ route }: ScreenProps<'Setor'>) {
  const { sector } = route.params;
  const queue = useApi<{ items: SectorItem[] }>(`/api/pdv/sector/${sector}`, { pollMs: POLL_MS });
  const { run, busy, error } = useAction();
  const [tab, setTab] = useState<ItemStatus>('pendente');

  const counts = useMemo(() => {
    const c: Record<string, number> = { pendente: 0, preparando: 0, pronto: 0, entregue: 0 };
    for (const it of queue.data?.items || []) if (c[it.status] !== undefined) c[it.status]++;
    return c;
  }, [queue.data]);

  const column = COLUMNS.find((c) => c.status === tab)!;
  const items = (queue.data?.items || []).filter((i) => i.status === tab);

  const advance = (item: SectorItem, next: ItemStatus) => {
    void run(
      async () => {
        await api(`/api/pdv/tab-items/${item.id}`, { method: 'PUT', body: { status: next } });
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      queue.reload
    );
  };

  if (queue.loading && !queue.data) return <Loading />;

  return (
    <View style={s.wrap}>
      <View style={s.tabs}>
        {COLUMNS.map((c) => {
          const on = c.status === tab;
          const color = statusColor[c.status];
          return (
            <Pressable
              key={c.status}
              onPress={() => setTab(c.status)}
              style={({ pressed }) => [s.tab, on && { borderColor: color, backgroundColor: color + '18' }, pressed && { opacity: 0.7 }]}
            >
              <Text style={[s.tabLabel, on && { color: colors.text }]} numberOfLines={1}>{c.label}</Text>
              <Mono style={[s.tabCount, { color: counts[c.status] ? color : colors.textDim }]}>
                {counts[c.status]}
              </Mono>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={queue.reload} tintColor={colors.gold} />}
      >
        {queue.error ? <ErrorBox message={queue.error} onRetry={queue.reload} /> : null}
        {error ? <ErrorBox message={error} /> : null}

        {items.length === 0 ? (
          <EmptyState
            icon={column.icon}
            message={
              tab === 'pendente'
                ? `Nenhum pedido novo em ${sectorLabel[sector]}.`
                : `Nada em "${column.label}" agora.`
            }
          />
        ) : (
          items.map((it) => {
            const minutes = elapsedMinutes(it.created_at);
            // Pedido parado é o que estraga a noite: acima de 15min a linha
            // do tempo fica vermelha pra saltar aos olhos de longe.
            const late = it.status !== 'entregue' && minutes >= 15;
            return (
              <View key={it.id} style={[s.card, late && { borderColor: colors.danger + '88' }]}>
                <View style={s.cardTop}>
                  <Mono style={s.qty}>{it.qty}×</Mono>
                  <Text style={s.name} numberOfLines={2}>{it.name}</Text>
                  <Text style={[s.time, late && { color: colors.danger, fontWeight: '700' }]}>
                    {formatElapsed(minutes)}
                  </Text>
                </View>

                <Text style={s.meta} numberOfLines={1}>
                  {it.tab_label}
                  {it.guest_name ? ` · ${it.guest_name}` : ''}
                  {it.waiter_name ? ` · ${it.waiter_name}` : ''}
                </Text>
                {it.note ? <Text style={s.note}>“{it.note}”</Text> : null}

                {column.next ? (
                  <Pressable
                    disabled={busy}
                    onPress={() => advance(it, column.next!)}
                    style={({ pressed }) => [
                      s.action,
                      { borderColor: statusColor[column.next!] + 'aa', backgroundColor: statusColor[column.next!] + '18' },
                      pressed && { opacity: 0.7 },
                      busy && { opacity: 0.5 },
                    ]}
                  >
                    <Ionicons name="arrow-forward" size={15} color={statusColor[column.next!]} />
                    <Text style={[s.actionText, { color: statusColor[column.next!] }]}>{column.nextLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: space.xxl },

  tabs: {
    flexDirection: 'row', gap: space.sm,
    paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm,
    borderBottomColor: colors.borderSoft, borderBottomWidth: 1,
  },
  tab: {
    flex: 1, alignItems: 'center', gap: 1,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingVertical: space.sm, paddingHorizontal: 4,
  },
  tabLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  tabCount: { fontSize: 17, fontWeight: '700' },

  card: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  qty: { color: colors.goldLight, fontSize: 16, fontWeight: '700' },
  name: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  time: { color: colors.textDim, fontSize: 12 },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  note: { color: colors.goldLight, fontSize: 12, marginTop: 4, fontStyle: 'italic' },

  action: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderRadius: radius.md,
    paddingVertical: 10, marginTop: space.md,
  },
  actionText: { fontSize: 14, fontWeight: '700' },
});
