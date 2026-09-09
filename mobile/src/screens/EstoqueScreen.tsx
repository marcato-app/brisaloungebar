import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { useApi, useAction } from '../hooks';
import { EmptyState, ErrorBox, Fab, Field, Loading, Mono, SearchBar } from '../ui';
import FormSheet from '../components/FormSheet';
import { colors, radius, space } from '../theme';
import type { StockItem } from '../types';

interface Draft {
  id?: string;
  name: string;
  unit: string;
  qty: string;
  minQty: string;
}

const EMPTY: Draft = { name: '', unit: '', qty: '0', minQty: '' };

function isLow(it: StockItem): boolean {
  return it.min_qty != null && it.qty <= it.min_qty;
}

export default function EstoqueScreen() {
  const list = useApi<{ stock: StockItem[] }>('/api/pdv/stock');
  const { run, busy, error } = useAction();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);

  const stock = list.data?.stock || [];
  const low = useMemo(() => stock.filter(isLow), [stock]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? stock.filter((it) => it.name.toLowerCase().includes(q)) : stock;
  }, [stock, query]);

  const save = () => {
    if (!draft) return;
    void run(
      async () => {
        const body = {
          name: draft.name.trim(),
          unit: draft.unit.trim(),
          qty: Number(String(draft.qty).replace(',', '.')),
          minQty: draft.minQty.trim() === '' ? null : Number(String(draft.minQty).replace(',', '.')),
        };
        if (draft.id) await api(`/api/pdv/stock/${draft.id}`, { method: 'PUT', body });
        else await api('/api/pdv/stock', { method: 'POST', body });
      },
      () => {
        setDraft(null);
        list.reload();
      }
    );
  };

  // Contagem de prateleira é "tirei duas, entraram seis": ajustar direto na
  // linha evita abrir formulário 40 vezes seguidas durante o inventário.
  const adjust = async (it: StockItem, delta: number) => {
    const next = Math.max(0, Number((it.qty + delta).toFixed(3)));
    if (next === it.qty) return;
    setAdjusting(it.id);
    try {
      await api(`/api/pdv/stock/${it.id}`, {
        method: 'PUT',
        body: { name: it.name, unit: it.unit || '', qty: next, minQty: it.min_qty },
      });
      await Haptics.selectionAsync();
      list.reload();
    } catch {
      // O reload devolve o valor real do servidor; erro de rede não pode
      // deixar a tela mostrando uma contagem que não foi gravada.
      list.reload();
    } finally {
      setAdjusting(null);
    }
  };

  if (list.loading && !list.data) return <Loading />;

  return (
    <>
      <ScrollView
        style={s.wrap}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={list.reload} tintColor={colors.gold} />}
      >
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar item…" />

        {list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : null}

        {low.length > 0 && !query ? (
          <View style={s.lowBox}>
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={s.lowText}>
              {low.length === 1 ? '1 item no mínimo' : `${low.length} itens no mínimo`}: {low.map((i) => i.name).join(', ')}
            </Text>
          </View>
        ) : null}

        {shown.length === 0 ? (
          <EmptyState icon="cube-outline" message={query ? 'Nada com esse nome.' : 'Estoque vazio — cadastre o primeiro item.'} />
        ) : (
          shown.map((it) => {
            const lowNow = isLow(it);
            const bloqueado = adjusting === it.id;
            return (
              <View key={it.id} style={[s.row, lowNow && { borderColor: colors.danger + '77' }]}>
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() =>
                    setDraft({
                      id: it.id,
                      name: it.name,
                      unit: it.unit || '',
                      qty: String(it.qty),
                      minQty: it.min_qty == null ? '' : String(it.min_qty),
                    })
                  }
                >
                  <Text style={s.name} numberOfLines={1}>{it.name}</Text>
                  <Text style={s.meta}>
                    {it.unit || 'un'}
                    {it.min_qty != null ? ` · mínimo ${it.min_qty}` : ''}
                  </Text>
                </Pressable>

                <View style={s.stepper}>
                  <Pressable onPress={() => void adjust(it, -1)} disabled={bloqueado} hitSlop={6} style={s.stepBtn}>
                    <Ionicons name="remove" size={17} color={it.qty > 0 ? colors.text : colors.textDim} />
                  </Pressable>
                  <Mono style={[s.qty, lowNow && { color: colors.danger }]}>{it.qty}</Mono>
                  <Pressable onPress={() => void adjust(it, 1)} disabled={bloqueado} hitSlop={6} style={s.stepBtn}>
                    <Ionicons name="add" size={17} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Fab label="Item" onPress={() => setDraft({ ...EMPTY })} />

      <FormSheet
        visible={draft !== null}
        title={draft?.id ? 'Editar item' : 'Novo item de estoque'}
        onCancel={() => setDraft(null)}
        onSubmit={save}
        busy={busy}
        error={error}
      >
        <Field
          label="Nome"
          value={draft?.name || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, name: t } : d))}
          autoFocus={!draft?.id}
        />
        <Field
          label="Unidade"
          value={draft?.unit || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, unit: t } : d))}
          placeholder="garrafa, kg, caixa…"
        />
        <Field
          label="Quantidade"
          value={draft?.qty || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, qty: t } : d))}
          keyboardType="decimal-pad"
        />
        <Field
          label="Quantidade mínima (opcional)"
          value={draft?.minQty || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, minQty: t } : d))}
          keyboardType="decimal-pad"
          placeholder="alerta quando chegar aqui"
        />
      </FormSheet>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: 96 },

  lowBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.danger + '14',
    borderColor: colors.danger + '44', borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginTop: space.md,
  },
  lowText: { color: colors.text, fontSize: 13, flex: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginTop: space.sm,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  stepper: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 5,
  },
  stepBtn: { padding: 3 },
  qty: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 30, textAlign: 'center' },
});
