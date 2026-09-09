import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { POLL_MS } from '../config';
import { useApi, useAction } from '../hooks';
import { formatCents, elapsedMinutes, formatElapsed, initials } from '../format';
import { avatarColor, Card, EmptyState, ErrorBox, Loading, Mono, Pill, SectionHead, StatusPill } from '../ui';
import { colors, radius, sectorLabel, space } from '../theme';
import PromptModal from '../components/PromptModal';
import ManagerAuthModal from '../components/ManagerAuthModal';
import ItemPicker from '../components/ItemPicker';
import PaymentSection from '../components/PaymentSection';
import type { ScreenProps } from '../navigation';
import type { TabDetail, TabItem } from '../types';

export default function ComandaScreen({ route, navigation }: ScreenProps<'Comanda'>) {
  const { tabId } = route.params;
  const tab = useApi<TabDetail>(`/api/pdv/tabs/${tabId}`, { pollMs: POLL_MS });
  const { run } = useAction();

  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<TabItem | null>(null);

  const data = tab.data;

  // Assim que a comanda carrega, a primeira pessoa já vem selecionada: numa
  // mesa de uma pessoa só (o caso comum) ninguém precisa tocar em nada antes
  // de lançar. Só reage quando a lista de pessoas muda de verdade.
  const guestIds = (data?.guests || []).map((g) => g.id).join(',');
  useEffect(() => {
    const first = data?.guests?.[0]?.id ?? null;
    setSelectedGuestId((cur) => (cur && guestIds.split(',').includes(cur) ? cur : first));
  }, [guestIds, data?.guests]);

  // O título da tela acompanha o nome da comanda (que pode mudar numa
  // transferência) em vez de ficar preso ao que veio na navegação.
  useEffect(() => {
    if (data?.label) navigation.setOptions({ title: data.label });
  }, [data?.label, navigation]);

  if (tab.loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={s.wrap}>
        <ErrorBox message={tab.error || 'Comanda não encontrada'} onRetry={tab.reload} />
      </View>
    );
  }

  const aberta = data.status === 'aberta';

  const addGuest = async (name: string) => {
    await api(`/api/pdv/tabs/${tabId}/guests`, { method: 'POST', body: { name } });
    setAddingGuest(false);
    tab.reload();
  };

  const cancelItem = async (username: string, password: string) => {
    if (!cancelTarget) return;
    await api(`/api/pdv/tab-items/${cancelTarget.id}`, {
      method: 'PUT',
      body: { status: 'cancelado', managerUsername: username, managerPassword: password },
    });
    setCancelTarget(null);
    tab.reload();
  };

  const markDelivered = (item: TabItem) => {
    void run(
      () => api(`/api/pdv/tab-items/${item.id}`, { method: 'PUT', body: { status: 'entregue' } }),
      tab.reload
    );
  };

  return (
    <>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={tab.reload} tintColor={colors.gold} />}
      >
        {tab.error ? <ErrorBox message={tab.error} onRetry={tab.reload} /> : null}

        {/* ------------------------------------------------------ resumo */}
        <Card>
          <View style={s.summaryTop}>
            <View>
              <Text style={s.summaryLabel}>Total da comanda</Text>
              <Text style={s.summaryTime}>
                aberta há {formatElapsed(elapsedMinutes(data.opened_at))}
              </Text>
            </View>
            <Mono style={s.summaryTotal}>{formatCents(data.totalCents)}</Mono>
          </View>
          <View style={s.bar}>
            <View
              style={[
                s.barFill,
                { width: `${data.totalCents ? Math.min(100, (data.paidCents / data.totalCents) * 100) : 0}%` },
              ]}
            />
          </View>
          <View style={s.summaryRows}>
            <View style={s.summaryRow}>
              <View style={[s.dot, { backgroundColor: colors.ok }]} />
              <Text style={s.summaryRowText}>Pago</Text>
              <Mono style={s.summaryRowValue}>{formatCents(data.paidCents)}</Mono>
            </View>
            <View style={s.summaryRow}>
              <View style={[s.dot, { backgroundColor: data.pendingCents > 0 ? colors.danger : colors.ok }]} />
              <Text style={s.summaryRowText}>Pendente</Text>
              <Mono style={s.summaryRowValue}>{formatCents(data.pendingCents)}</Mono>
            </View>
          </View>
          {!aberta ? <Pill text="comanda fechada" color={colors.entregue} /> : null}
        </Card>

        {/* ----------------------------------------------------- pessoas */}
        <SectionHead icon="people-outline" title="Pessoas" />
        <View style={s.chips}>
          {data.guests.map((g) => {
            const on = selectedGuestId === g.id;
            const c = avatarColor(g.name);
            return (
              <Pressable
                key={g.id}
                onPress={() => setSelectedGuestId(g.id)}
                style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.7 }]}
              >
                <View style={[s.chipAvatar, { backgroundColor: c + '33' }]}>
                  <Text style={{ color: c, fontSize: 9, fontWeight: '700' }}>{initials(g.name)}</Text>
                </View>
                <Text style={[s.chipText, on && { color: colors.text }]}>{g.name}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setSelectedGuestId(null)}
            style={({ pressed }) => [s.chip, selectedGuestId === null && s.chipOn, pressed && { opacity: 0.7 }]}
          >
            <Text style={[s.chipText, selectedGuestId === null && { color: colors.text }]}>Compartilhado</Text>
          </Pressable>
        </View>
        {aberta ? (
          <Pressable
            onPress={() => setAddingGuest(true)}
            style={({ pressed }) => [s.addGuest, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="add" size={14} color={colors.textDim} />
            <Text style={s.addGuestText}>Pessoa</Text>
          </Pressable>
        ) : null}

        {/* ------------------------------------------------------- itens */}
        <SectionHead icon="receipt-outline" title="Itens" />
        {data.items.length === 0 ? (
          <EmptyState icon="receipt-outline" message="Nada lançado ainda." />
        ) : (
          data.items.map((it) => (
            <ItemLine
              key={it.id}
              item={it}
              editable={aberta}
              onCancel={() => setCancelTarget(it)}
              onDeliver={() => markDelivered(it)}
            />
          ))
        )}

        {/* --------------------------------------------- lançar e pagar */}
        {aberta ? (
          <>
            <ItemPicker tabId={tabId} guestId={selectedGuestId} onLaunched={tab.reload} />
            <PaymentSection tab={data} onChanged={tab.reload} />
          </>
        ) : null}

        {/* ------------------------------------------------- pagamentos */}
        {data.payments.length > 0 ? (
          <>
            <SectionHead icon="wallet-outline" title="Pagamentos" />
            {data.payments.map((p) => (
              <View key={p.id} style={s.payRow}>
                <Ionicons name="checkmark-circle" size={17} color={colors.ok} />
                <View style={{ flex: 1 }}>
                  <Text style={s.payMethod}>{p.method}</Text>
                  <Text style={s.payWho}>{p.payer_name || 'Sem nome informado'}</Text>
                </View>
                <Mono style={s.payAmount}>{formatCents(p.amount_cents)}</Mono>
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>

      <PromptModal
        visible={addingGuest}
        title="Nova pessoa"
        message={`Nome de quem está entrando na comanda "${data.label}".`}
        label="Nome"
        confirmLabel="Adicionar"
        onCancel={() => setAddingGuest(false)}
        onConfirm={addGuest}
      />

      <ManagerAuthModal
        visible={cancelTarget !== null}
        message={`Cancelar "${cancelTarget?.name ?? ''}" — confirme com usuário e senha de um gerente.`}
        onCancel={() => setCancelTarget(null)}
        onConfirm={cancelItem}
      />
    </>
  );
}

function ItemLine({
  item, editable, onCancel, onDeliver,
}: {
  item: TabItem;
  editable: boolean;
  onCancel: () => void;
  onDeliver: () => void;
}) {
  const cancelavel = editable && item.status !== 'cancelado' && item.status !== 'entregue' && !item.paid;
  const entregavel = editable && item.status === 'pronto';

  return (
    <View style={s.itemLine}>
      <View style={s.itemIcon}>
        <Ionicons
          name={item.sector === 'tabacaria' ? 'cloud-outline' : 'flame-outline'}
          size={15}
          color={colors.textDim}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.itemName} numberOfLines={2}>
          {item.qty}× {item.name}
        </Text>
        <View style={s.itemMeta}>
          <StatusPill status={item.status} />
          {item.status !== 'cancelado' ? (
            <Pill text={item.paid ? 'pago' : 'a pagar'} color={item.paid ? colors.entregue : colors.novo} />
          ) : null}
        </View>
        <Text style={s.itemWho} numberOfLines={1}>
          {item.guest_name ? item.guest_name + ' · ' : ''}
          {sectorLabel[item.sector]} · {item.waiter_name || '—'}
        </Text>
      </View>

      <View style={s.itemRight}>
        <Mono style={s.itemPrice}>{formatCents(item.unit_price_cents * item.qty)}</Mono>
        <View style={s.itemActions}>
          {entregavel ? (
            <Pressable onPress={onDeliver} hitSlop={8} style={s.itemAction}>
              <Ionicons name="checkmark-done" size={17} color={colors.ok} />
            </Pressable>
          ) : null}
          {cancelavel ? (
            <Pressable onPress={onCancel} hitSlop={8} style={s.itemAction}>
              <Ionicons name="close" size={17} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: space.xxl },

  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: space.md },
  summaryLabel: { color: colors.textDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryTime: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  summaryTotal: { color: colors.goldLight, fontSize: 26, fontWeight: '700' },
  bar: { height: 7, borderRadius: radius.pill, backgroundColor: colors.danger + '33', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.ok, borderRadius: radius.pill },
  summaryRows: { flexDirection: 'row', gap: space.xl, marginTop: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryRowText: { color: colors.textDim, fontSize: 13 },
  summaryRowValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card2,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill,
    paddingVertical: 5, paddingHorizontal: space.md,
  },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.gold + '1f' },
  chipAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.textDim, fontSize: 13 },
  addGuest: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    borderColor: colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.pill,
    paddingVertical: 6, paddingHorizontal: space.md, marginTop: space.sm,
  },
  addGuestText: { color: colors.textDim, fontSize: 13 },

  itemLine: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  itemIcon: {
    width: 30, height: 30, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.textDim + '1f',
  },
  itemName: { color: colors.text, fontSize: 15 },
  itemMeta: { flexDirection: 'row', gap: 6, marginTop: 5 },
  itemWho: { color: colors.textDim, fontSize: 11.5, marginTop: 5 },
  itemRight: { alignItems: 'flex-end', gap: space.sm },
  itemPrice: { color: colors.text, fontSize: 14, fontWeight: '600' },
  itemActions: { flexDirection: 'row', gap: space.sm },
  itemAction: { padding: 2 },

  payRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  payMethod: { color: colors.text, fontSize: 14, textTransform: 'capitalize' },
  payWho: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  payAmount: { color: colors.ok, fontSize: 14, fontWeight: '700' },
});
