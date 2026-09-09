import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { POLL_MS } from '../config';
import { useApi } from '../hooks';
import { formatCents, elapsedMinutes, formatElapsed } from '../format';
import { Button, EmptyState, ErrorBox, Loading, Mono, SectionHead } from '../ui';
import PromptModal from '../components/PromptModal';
import { colors, radius, space } from '../theme';
import type { ScreenProps } from '../navigation';
import type { TabSummary } from '../types';

type MesaState = 'livre' | 'ocupada' | 'aguardando';

const STATE_COLOR: Record<MesaState, string> = {
  livre: colors.ok,
  ocupada: colors.gold,
  aguardando: colors.danger,
};

const STATE_LABEL: Record<MesaState, string> = {
  livre: 'Livre',
  ocupada: 'Ocupada',
  aguardando: 'Fechar conta',
};

export default function ComandasScreen({ navigation }: ScreenProps<'Comandas'>) {
  const { width } = useWindowDimensions();
  // Largura em pixel, não em porcentagem: com % o gap entra por cima e a
  // quarta mesa não cabe na linha — o mapa vira 3 por linha sozinho.
  const tileWidth = (width - space.lg * 2 - space.sm * 3) / 4;
  const tabs = useApi<{ tabs: TabSummary[] }>('/api/pdv/tabs', { pollMs: POLL_MS });
  const settings = useApi<{ settings: Record<string, string> }>('/api/pdv/settings');
  const [opening, setOpening] = useState<{ kind: 'mesa'; n: number } | { kind: 'avulsa' } | null>(null);

  const tableCount = Number(settings.data?.settings?.table_count) || 12;

  const byTable = useMemo(() => {
    const map: Record<number, TabSummary> = {};
    for (const t of tabs.data?.tabs || []) {
      if (t.table_number != null) map[t.table_number] = t;
    }
    return map;
  }, [tabs.data]);

  const avulsas = useMemo(
    () => (tabs.data?.tabs || []).filter((t) => t.table_number == null),
    [tabs.data]
  );

  const openTab = async (guestName: string) => {
    if (!opening) return;
    const body = opening.kind === 'mesa'
      ? { tableNumber: opening.n, guestName }
      : { label: guestName, guestName };
    const res = await api<{ id: string }>('/api/pdv/tabs', { method: 'POST', body });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOpening(null);
    tabs.reload();
    const label = opening.kind === 'mesa' ? `Mesa ${opening.n}` : guestName;
    navigation.navigate('Comanda', { tabId: res.id, label });
  };

  if (tabs.loading && !tabs.data) return <Loading />;

  return (
    <>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={tabs.reload} tintColor={colors.gold} />
        }
      >
        {tabs.error ? <ErrorBox message={tabs.error} onRetry={tabs.reload} /> : null}

        <View style={s.grid}>
          {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
            <MesaTile
              key={n}
              n={n}
              width={tileWidth}
              tab={byTable[n]}
              onPress={() => {
                const tab = byTable[n];
                if (tab) navigation.navigate('Comanda', { tabId: tab.id, label: tab.label });
                else setOpening({ kind: 'mesa', n });
              }}
            />
          ))}
        </View>

        <SectionHead icon="person-outline" title="Balcão / Avulso" />
        {avulsas.length === 0 ? (
          <EmptyState icon="person-outline" message="Nenhuma comanda avulsa aberta." />
        ) : (
          avulsas.map((t) => (
            <Pressable
              key={t.id}
              style={({ pressed }) => [s.avulsaRow, pressed && { opacity: 0.7 }]}
              onPress={() => navigation.navigate('Comanda', { tabId: t.id, label: t.label })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.avulsaName}>{t.label}</Text>
                <Text style={s.avulsaMeta}>
                  aberta há {formatElapsed(elapsedMinutes(t.opened_at))}
                  {t.allDelivered ? ' · tudo entregue' : ''}
                </Text>
              </View>
              <Mono style={s.avulsaTotal}>{formatCents(t.totalCents)}</Mono>
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          ))
        )}

        <Button
          title="Abrir comanda avulsa"
          icon="add"
          variant="secondary"
          onPress={() => setOpening({ kind: 'avulsa' })}
          style={{ marginTop: space.lg }}
        />
      </ScrollView>

      <PromptModal
        visible={opening !== null}
        title={opening?.kind === 'mesa' ? `Abrir Mesa ${opening.n}` : 'Abrir comanda avulsa'}
        message={
          opening?.kind === 'mesa'
            ? 'Nome de quem está abrindo a mesa — dá pra acrescentar mais gente depois.'
            : 'Nome da comanda (cliente no balcão, viagem…).'
        }
        label="Nome"
        confirmLabel={opening?.kind === 'mesa' ? 'Abrir mesa' : 'Abrir'}
        onCancel={() => setOpening(null)}
        onConfirm={openTab}
      />
    </>
  );
}

function MesaTile({ n, tab, width, onPress }: { n: number; tab?: TabSummary; width: number; onPress: () => void }) {
  const state: MesaState = !tab ? 'livre' : tab.allDelivered ? 'aguardando' : 'ocupada';
  const color = STATE_COLOR[state];
  const minutes = tab ? elapsedMinutes(tab.opened_at) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        { width, borderColor: color + (state === 'livre' ? '55' : 'cc') },
        state !== 'livre' && { backgroundColor: color + '12' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={s.tileTop}>
        <Mono style={[s.tileNumber, { color: state === 'livre' ? colors.textDim : colors.text }]}>
          {String(n).padStart(2, '0')}
        </Mono>
        {state === 'aguardando' ? <Ionicons name="cash-outline" size={13} color={color} /> : null}
      </View>
      <Text style={[s.tileState, { color }]} numberOfLines={1}>{STATE_LABEL[state]}</Text>
      {tab ? (
        <>
          <Mono style={s.tileTotal}>{formatCents(tab.pendingCents > 0 ? tab.pendingCents : tab.totalCents)}</Mono>
          <Text style={s.tileTime}>{formatElapsed(minutes)}</Text>
        </>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: space.xxl },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    // Quatro por linha (a largura vem calculada da tela): o mapa inteiro cabe
    // num celular em vez de exigir quatro rolagens no meio do movimento.
    aspectRatio: 0.86,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tileNumber: { fontSize: 19, fontWeight: '700' },
  tileState: { fontSize: 8.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  tileTotal: { color: colors.text, fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  tileTime: { color: colors.textDim, fontSize: 9 },

  avulsaRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  avulsaName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  avulsaMeta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  avulsaTotal: { color: colors.goldLight, fontSize: 14, fontWeight: '700' },
});
