import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useApi, useAction } from '../hooks';
import { formatDate } from '../format';
import { Avatar, EmptyState, ErrorBox, Fab, Field, Loading, Pill, SearchBar } from '../ui';
import FormSheet from '../components/FormSheet';
import { colors, radius, space } from '../theme';
import type { Customer } from '../types';

interface Draft {
  id?: string;
  name: string;
  phone: string;
  birthDate: string;
  note: string;
}

const EMPTY: Draft = { name: '', phone: '', birthDate: '', note: '' };

export default function ClientesScreen() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const { run, busy, error } = useAction();

  // Sem o debounce, cada letra digitada vira uma consulta — no 4G do bar isso
  // é a lista piscando e resposta antiga chegando depois da nova.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const path = debounced ? `/api/pdv/customers?q=${encodeURIComponent(debounced)}` : '/api/pdv/customers';
  const list = useApi<{ customers: Customer[] }>(path);

  const thisMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const customers = list.data?.customers || [];

  const birthdays = useMemo(
    () => customers.filter((c) => c.birth_date && c.birth_date.slice(5, 7) === thisMonth),
    [customers, thisMonth]
  );

  const save = () => {
    if (!draft) return;
    void run(
      async () => {
        const body = {
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          birthDate: draft.birthDate.trim() || null,
          note: draft.note.trim(),
        };
        if (draft.id) await api(`/api/pdv/customers/${draft.id}`, { method: 'PUT', body });
        else await api('/api/pdv/customers', { method: 'POST', body });
      },
      () => {
        setDraft(null);
        list.reload();
      }
    );
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
        <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar por nome ou telefone…" />

        {list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : null}

        {!debounced && birthdays.length > 0 ? (
          <View style={s.birthdayBox}>
            <Ionicons name="gift-outline" size={16} color={colors.pink} />
            <Text style={s.birthdayText}>
              {birthdays.length === 1
                ? `${birthdays[0].name} faz aniversário este mês.`
                : `${birthdays.length} clientes fazem aniversário este mês.`}
            </Text>
          </View>
        ) : null}

        {customers.length === 0 ? (
          <EmptyState
            icon="person-outline"
            message={debounced ? 'Nenhum cliente com esse nome ou telefone.' : 'Nenhum cliente cadastrado ainda.'}
          />
        ) : (
          customers.map((c) => (
            <Pressable
              key={c.id}
              onPress={() =>
                setDraft({
                  id: c.id,
                  name: c.name,
                  phone: c.phone || '',
                  birthDate: c.birth_date || '',
                  note: c.note || '',
                })
              }
              style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
            >
              <Avatar name={c.name} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{c.name}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {c.phone || 'sem telefone'}
                  {c.birth_date ? ` · ${formatDate(c.birth_date)}` : ''}
                </Text>
              </View>
              {c.birth_date && c.birth_date.slice(5, 7) === thisMonth ? (
                <Pill text="aniversário" color={colors.pink} />
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Fab label="Cliente" onPress={() => setDraft({ ...EMPTY })} />

      <FormSheet
        visible={draft !== null}
        title={draft?.id ? 'Editar cliente' : 'Novo cliente'}
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
          label="Telefone"
          value={draft?.phone || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, phone: t } : d))}
          keyboardType="phone-pad"
        />
        <Field
          label="Aniversário (AAAA-MM-DD)"
          value={draft?.birthDate || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, birthDate: t } : d))}
          placeholder="1990-05-21"
          autoCapitalize="none"
        />
        <Field
          label="Observação"
          value={draft?.note || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, note: t } : d))}
          multiline
          style={{ minHeight: 74, textAlignVertical: 'top' }}
        />
      </FormSheet>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: 96 },

  birthdayBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.pink + '14',
    borderColor: colors.pink + '44', borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginTop: space.md,
  },
  birthdayText: { color: colors.text, fontSize: 13, flex: 1 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginTop: space.sm,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
