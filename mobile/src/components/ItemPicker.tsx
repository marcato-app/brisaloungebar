import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { useApi, useAction } from '../hooks';
import { formatCents } from '../format';
import { EmptyState, ErrorBox, Mono, SectionHead } from '../ui';
import { colors, radius, space } from '../theme';
import type { CatalogItem, CatalogSection } from '../types';

interface Props {
  tabId: string;
  /** De quem é o próximo pedido; null = compartilhado (balde da mesa). */
  guestId: string | null;
  onLaunched: () => void;
}

export default function ItemPicker({ tabId, guestId, onLaunched }: Props) {
  const catalog = useApi<{ sections: CatalogSection[] }>('/api/pdv/catalog');
  const { run, busy, error } = useAction();
  const [query, setQuery] = useState('');
  const [qty, setQty] = useState(1);

  const all = useMemo(() => {
    const out: CatalogItem[] = [];
    for (const s of catalog.data?.sections || []) {
      for (const g of s.groups) out.push(...g.items);
    }
    return out;
  }, [catalog.data]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((it) => it.name.toLowerCase().includes(q)).slice(0, 8);
  }, [all, query]);

  const launch = (item: CatalogItem) => {
    void run(
      async () => {
        await api(`/api/pdv/tabs/${tabId}/items`, {
          method: 'POST',
          body: { itemId: item.id, qty, guestId },
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      () => {
        setQuery('');
        setQty(1);
        onLaunched();
      }
    );
  };

  return (
    <View>
      <SectionHead icon="add-circle-outline" title="Lançar item" />
      {error ? <ErrorBox message={error} /> : null}

      <View style={s.searchRow}>
        <Ionicons name="search" size={17} color={colors.textDim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar item pelo nome…"
          placeholderTextColor={colors.textDim}
          style={s.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={17} color={colors.textDim} />
          </Pressable>
        ) : null}
      </View>

      {/* Quantidade antes de escolher o item: "3 doses de Jack" vira um toque
          em vez de lançar o mesmo item três vezes seguidas. */}
      <View style={s.qtyRow}>
        <Text style={s.qtyLabel}>Quantidade</Text>
        <View style={s.qtyControl}>
          <Pressable
            onPress={() => setQty((q) => Math.max(1, q - 1))}
            style={({ pressed }) => [s.qtyBtn, pressed && { opacity: 0.6 }]}
            hitSlop={6}
          >
            <Ionicons name="remove" size={17} color={qty > 1 ? colors.text : colors.textDim} />
          </Pressable>
          <Mono style={s.qtyValue}>{qty}</Mono>
          <Pressable
            onPress={() => setQty((q) => Math.min(99, q + 1))}
            style={({ pressed }) => [s.qtyBtn, pressed && { opacity: 0.6 }]}
            hitSlop={6}
          >
            <Ionicons name="add" size={17} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {catalog.error ? <ErrorBox message={catalog.error} onRetry={catalog.reload} /> : null}

      {query && matches.length === 0 && !catalog.loading ? (
        <EmptyState icon="search" message="Nada encontrado." />
      ) : null}

      {matches.map((it) => (
        <Pressable
          key={it.id}
          disabled={busy}
          onPress={() => launch(it)}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }, busy && { opacity: 0.5 }]}
        >
          <Text style={s.rowName} numberOfLines={1}>
            {it.name}
            {it.unit ? <Text style={s.rowUnit}> {it.unit}</Text> : null}
          </Text>
          <Mono style={s.rowPrice}>
            {qty > 1 ? `${qty}× ` : ''}{formatCents(it.priceCents * qty)}
          </Mono>
        </Pressable>
      ))}

    </View>
  );
}

const s = StyleSheet.create({
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.blackSoft,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },

  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md,
  },
  qtyLabel: { color: colors.textDim, fontSize: 13 },
  qtyControl: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 5,
  },
  qtyBtn: { padding: 3 },
  qtyValue: { color: colors.text, fontSize: 16, fontWeight: '700', minWidth: 22, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginTop: space.sm,
  },
  rowName: { color: colors.text, fontSize: 15, flex: 1 },
  rowUnit: { color: colors.textDim, fontSize: 12 },
  rowPrice: { color: colors.goldLight, fontSize: 14, fontWeight: '700' },
});
