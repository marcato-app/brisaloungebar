import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { useApi, useAction } from '../hooks';
import { formatCents, formatDate, parseCents, todayISO } from '../format';
import { Button, EmptyState, ErrorBox, Fab, Field, Loading, Mono, Pill } from '../ui';
import FormSheet from '../components/FormSheet';
import { colors, radius, space } from '../theme';
import type { Expense } from '../types';

type Filter = 'aberta' | 'paga' | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'aberta', label: 'Em aberto' },
  { key: 'paga', label: 'Pagas' },
  { key: 'all', label: 'Todas' },
];

interface Draft {
  id?: string;
  description: string;
  amount: string;
  dueDate: string;
  category: string;
  recurring: boolean;
  paid: boolean;
}

const EMPTY: Draft = { description: '', amount: '', dueDate: '', category: '', recurring: false, paid: false };

export default function FinanceiroScreen() {
  const [filter, setFilter] = useState<Filter>('aberta');
  const list = useApi<{ expenses: Expense[] }>(`/api/pdv/expenses?status=${filter}`);
  const { run, busy, error } = useAction();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const expenses = list.data?.expenses || [];
  const hoje = todayISO();

  const openTotal = useMemo(
    () => expenses.filter((e) => !e.paid_at).reduce((sum, e) => sum + e.amount_cents, 0),
    [expenses]
  );
  const overdue = useMemo(
    () => expenses.filter((e) => !e.paid_at && e.due_date && e.due_date < hoje),
    [expenses, hoje]
  );

  const save = () => {
    if (!draft) return;
    const amountCents = parseCents(draft.amount);
    if (!draft.description.trim()) { setFormError('Informe a descrição'); return; }
    if (amountCents == null) { setFormError('Valor inválido'); return; }
    setFormError(null);
    void run(
      async () => {
        const body = {
          description: draft.description.trim(),
          amountCents,
          dueDate: draft.dueDate.trim() || null,
          category: draft.category.trim(),
          recurring: draft.recurring,
          paid: draft.paid,
        };
        if (draft.id) await api(`/api/pdv/expenses/${draft.id}`, { method: 'PUT', body });
        else await api('/api/pdv/expenses', { method: 'POST', body });
      },
      () => {
        setDraft(null);
        list.reload();
      }
    );
  };

  const togglePaid = (e: Expense) => {
    void run(
      async () => {
        await api(`/api/pdv/expenses/${e.id}`, {
          method: 'PUT',
          body: {
            description: e.description,
            amountCents: e.amount_cents,
            dueDate: e.due_date,
            category: e.category,
            recurring: !!e.recurring,
            paid: !e.paid_at,
          },
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      list.reload
    );
  };

  if (list.loading && !list.data) return <Loading />;

  return (
    <>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={list.reload} tintColor={colors.gold} />}
      >
        <View style={s.filters}>
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={({ pressed }) => [s.filter, on && s.filterOn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.filterText, on && { color: colors.text }]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : null}
        {error ? <ErrorBox message={error} /> : null}

        {filter !== 'paga' && openTotal > 0 ? (
          <View style={s.summary}>
            <View style={{ flex: 1 }}>
              <Text style={s.summaryLabel}>A pagar</Text>
              <Mono style={s.summaryValue}>{formatCents(openTotal)}</Mono>
            </View>
            {overdue.length > 0 ? (
              <View style={s.overdue}>
                <Ionicons name="alert-circle" size={15} color={colors.danger} />
                <Text style={s.overdueText}>
                  {overdue.length === 1 ? '1 vencida' : `${overdue.length} vencidas`}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {expenses.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            message={filter === 'paga' ? 'Nenhuma despesa paga ainda.' : 'Nenhuma despesa em aberto.'}
          />
        ) : (
          expenses.map((e) => {
            const atrasada = !e.paid_at && !!e.due_date && e.due_date < hoje;
            return (
              <Pressable
                key={e.id}
                onPress={() =>
                  setDraft({
                    id: e.id,
                    description: e.description,
                    amount: (e.amount_cents / 100).toFixed(2).replace('.', ','),
                    dueDate: e.due_date || '',
                    category: e.category || '',
                    recurring: !!e.recurring,
                    paid: !!e.paid_at,
                  })
                }
                style={({ pressed }) => [s.row, atrasada && { borderColor: colors.danger + '77' }, pressed && { opacity: 0.7 }]}
              >
                <Pressable onPress={() => togglePaid(e)} hitSlop={10} disabled={busy} style={s.check}>
                  <Ionicons
                    name={e.paid_at ? 'checkmark-circle' : 'ellipse-outline'}
                    size={24}
                    color={e.paid_at ? colors.ok : colors.textDim}
                  />
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={[s.desc, !!e.paid_at && s.descPaid]} numberOfLines={1}>{e.description}</Text>
                  <View style={s.metaRow}>
                    <Text style={[s.meta, atrasada && { color: colors.danger }]}>
                      {e.paid_at ? `pago em ${formatDate(e.paid_at)}` : e.due_date ? `vence ${formatDate(e.due_date)}` : 'sem vencimento'}
                    </Text>
                    {e.recurring ? <Pill text="fixa" color={colors.teal} /> : null}
                    {e.category ? <Pill text={e.category} /> : null}
                  </View>
                </View>

                <Mono style={s.amount}>{formatCents(e.amount_cents)}</Mono>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Fab label="Despesa" onPress={() => { setFormError(null); setDraft({ ...EMPTY }); }} />

      <FormSheet
        visible={draft !== null}
        title={draft?.id ? 'Editar despesa' : 'Nova despesa'}
        onCancel={() => setDraft(null)}
        onSubmit={save}
        busy={busy}
        error={formError || error}
        extra={
          draft?.id ? (
            <Button
              title={draft.paid ? 'Marcar como em aberto' : 'Marcar como paga'}
              variant="secondary"
              icon={draft.paid ? 'refresh-outline' : 'checkmark-circle-outline'}
              onPress={() => setDraft((d) => (d ? { ...d, paid: !d.paid } : d))}
            />
          ) : null
        }
      >
        <Field
          label="Descrição"
          value={draft?.description || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, description: t } : d))}
          autoFocus={!draft?.id}
        />
        <Field
          label="Valor"
          value={draft?.amount || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, amount: t } : d))}
          keyboardType="decimal-pad"
          placeholder="450,00"
        />
        <Field
          label="Vencimento (AAAA-MM-DD)"
          value={draft?.dueDate || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, dueDate: t } : d))}
          placeholder="2026-10-05"
          autoCapitalize="none"
        />
        <Field
          label="Categoria"
          value={draft?.category || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, category: t } : d))}
          placeholder="aluguel, fornecedor, energia…"
        />
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>Conta fixa (repete todo mês)</Text>
          <Switch
            value={!!draft?.recurring}
            onValueChange={(v) => setDraft((d) => (d ? { ...d, recurring: v } : d))}
            trackColor={{ true: colors.gold + '77', false: colors.border }}
            thumbColor={draft?.recurring ? colors.gold : colors.textDim}
          />
        </View>
      </FormSheet>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: 96 },

  filters: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  filter: {
    flex: 1, alignItems: 'center',
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  filterOn: { borderColor: colors.gold, backgroundColor: colors.gold + '14' },
  filterText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  summary: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.md,
  },
  summaryLabel: { color: colors.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { color: colors.goldLight, fontSize: 22, fontWeight: '700', marginTop: 2 },
  overdue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  overdueText: { color: colors.danger, fontSize: 13, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  check: { padding: 2 },
  desc: { color: colors.text, fontSize: 15, fontWeight: '600' },
  descPaid: { color: colors.textDim, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  meta: { color: colors.textDim, fontSize: 12 },
  amount: { color: colors.text, fontSize: 15, fontWeight: '700' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  switchLabel: { color: colors.text, fontSize: 14, flex: 1 },
});
