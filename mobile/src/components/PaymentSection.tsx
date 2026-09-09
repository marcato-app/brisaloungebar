import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { useAction } from '../hooks';
import { formatCents } from '../format';
import { Button, ErrorBox, Mono, SectionHead } from '../ui';
import { colors, radius, space } from '../theme';
import type { PaymentMethod, TabDetail } from '../types';

const METHODS: { key: PaymentMethod; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'dinheiro', label: 'Dinheiro', icon: 'cash-outline' },
  { key: 'pix', label: 'Pix', icon: 'flash-outline' },
  { key: 'debito', label: 'Débito', icon: 'card-outline' },
  { key: 'credito', label: 'Crédito', icon: 'card' },
  { key: 'outro', label: 'Outro', icon: 'ellipsis-horizontal' },
];

export default function PaymentSection({ tab, onChanged }: { tab: TabDetail; onChanged: () => void }) {
  const { run, busy, error } = useAction();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<PaymentMethod>('dinheiro');
  const [payerName, setPayerName] = useState('');

  // Só o que ainda dá pra cobrar: cancelado não se cobra, e item já pago
  // está travado do outro lado também (a API recusa cobrar duas vezes).
  const cobraveis = useMemo(
    () => tab.items.filter((i) => i.status !== 'cancelado' && !i.paid),
    [tab.items]
  );

  const selectedTotal = useMemo(
    () => cobraveis.filter((i) => selected.has(i.id)).reduce((sum, i) => sum + i.unit_price_cents * i.qty, 0),
    [cobraveis, selected]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(selected.size === cobraveis.length ? new Set() : new Set(cobraveis.map((i) => i.id)));
  };

  const pay = () => {
    void run(
      async () => {
        await api(`/api/pdv/tabs/${tab.id}/payments`, {
          method: 'POST',
          body: { tabItemIds: [...selected], method, payerName: payerName.trim() || undefined },
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      () => {
        setSelected(new Set());
        setPayerName('');
        onChanged();
      }
    );
  };

  const close = () => {
    void run(async () => {
      await api(`/api/pdv/tabs/${tab.id}/close`, { method: 'POST' });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, onChanged);
  };

  if (cobraveis.length === 0) {
    return (
      <View>
        <SectionHead icon="checkmark-circle-outline" title="Fechamento" />
        {error ? <ErrorBox message={error} /> : null}
        <Text style={s.allPaid}>Tudo pago.</Text>
        <Button title="Fechar comanda" icon="lock-closed-outline" onPress={close} loading={busy} />
      </View>
    );
  }

  return (
    <View>
      <SectionHead
        icon="card-outline"
        title="Registrar pagamento"
        right={
          <Pressable onPress={selectAll} hitSlop={8}>
            <Text style={s.selectAll}>
              {selected.size === cobraveis.length ? 'Limpar' : 'Todos'}
            </Text>
          </Pressable>
        }
      />
      {error ? <ErrorBox message={error} /> : null}

      {cobraveis.map((it) => {
        const on = selected.has(it.id);
        return (
          <Pressable
            key={it.id}
            onPress={() => toggle(it.id)}
            style={({ pressed }) => [s.row, on && s.rowOn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={on ? 'checkbox' : 'square-outline'}
              size={20}
              color={on ? colors.gold : colors.textDim}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.rowName} numberOfLines={1}>{it.qty}× {it.name}</Text>
              {it.guest_name ? <Text style={s.rowGuest}>{it.guest_name}</Text> : null}
            </View>
            <Mono style={s.rowPrice}>{formatCents(it.unit_price_cents * it.qty)}</Mono>
          </Pressable>
        );
      })}

      <View style={s.methods}>
        {METHODS.map((m) => {
          const on = method === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMethod(m.key)}
              style={({ pressed }) => [s.method, on && s.methodOn, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name={m.icon} size={16} color={on ? colors.gold : colors.textDim} />
              <Text style={[s.methodText, on && { color: colors.text }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        value={payerName}
        onChangeText={setPayerName}
        placeholder="Nome de quem paga (opcional)"
        placeholderTextColor={colors.textDim}
        style={s.payerInput}
      />

      <Button
        title={selected.size ? `Registrar ${formatCents(selectedTotal)}` : 'Selecione os itens'}
        icon="checkmark"
        onPress={pay}
        disabled={selected.size === 0}
        loading={busy}
        style={{ marginTop: space.md }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  rowOn: { borderColor: colors.gold + '99', backgroundColor: colors.gold + '10' },
  rowName: { color: colors.text, fontSize: 14 },
  rowGuest: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  rowPrice: { color: colors.text, fontSize: 14, fontWeight: '600' },

  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  method: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  methodOn: { borderColor: colors.gold, backgroundColor: colors.gold + '14' },
  methodText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  payerInput: {
    backgroundColor: colors.blackSoft,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 12,
    color: colors.text, fontSize: 15, marginTop: space.md,
  },

  allPaid: { color: colors.ok, fontSize: 14, textAlign: 'center', marginBottom: space.md },
  selectAll: { color: colors.goldLight, fontSize: 13, fontWeight: '700' },
});
