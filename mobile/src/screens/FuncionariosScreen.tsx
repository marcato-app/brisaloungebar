import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { useApi, useAction } from '../hooks';
import { Avatar, EmptyState, ErrorBox, Fab, Field, Loading, Pill } from '../ui';
import FormSheet from '../components/FormSheet';
import { colors, radius, roleLabel, space } from '../theme';
import { useSession } from '../session';
import type { Employee, Role } from '../types';

const ROLES: Role[] = ['garcom', 'caixa', 'gerente'];

interface Draft {
  id?: string;
  name: string;
  username: string;
  password: string;
  role: Role;
  active: boolean;
}

const EMPTY: Draft = { name: '', username: '', password: '', role: 'garcom', active: true };

export default function FuncionariosScreen() {
  const list = useApi<{ employees: Employee[] }>('/api/pdv/employees');
  const { run, busy, error } = useAction();
  const { me } = useSession();
  const [draft, setDraft] = useState<Draft | null>(null);

  const employees = list.data?.employees || [];

  const save = () => {
    if (!draft) return;
    void run(
      async () => {
        if (draft.id) {
          // A API não deixa trocar usuário depois de criado (é a chave do
          // login e assina o histórico de pedidos), então nem mandamos.
          const body: Record<string, unknown> = { name: draft.name.trim(), role: draft.role, active: draft.active };
          if (draft.password) body.password = draft.password;
          await api(`/api/pdv/employees/${draft.id}`, { method: 'PUT', body });
        } else {
          await api('/api/pdv/employees', {
            method: 'POST',
            body: {
              name: draft.name.trim(),
              username: draft.username.trim().toLowerCase(),
              password: draft.password,
              role: draft.role,
            },
          });
        }
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
        refreshControl={<RefreshControl refreshing={false} onRefresh={list.reload} tintColor={colors.gold} />}
      >
        {list.error ? <ErrorBox message={list.error} onRetry={list.reload} /> : null}
        {error ? <ErrorBox message={error} /> : null}

        {employees.length === 0 ? (
          <EmptyState icon="people-outline" message="Nenhum funcionário cadastrado." />
        ) : (
          employees.map((e) => (
            <Pressable
              key={e.id}
              onPress={() =>
                setDraft({
                  id: e.id,
                  name: e.name,
                  username: e.username,
                  password: '',
                  role: e.role,
                  active: e.active === 1,
                })
              }
              style={({ pressed }) => [s.row, !e.active && s.rowOff, pressed && { opacity: 0.7 }]}
            >
              <Avatar name={e.name} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>
                  {e.name}
                  {me?.id === e.id ? <Text style={s.you}> · você</Text> : null}
                </Text>
                <Text style={s.meta}>@{e.username}</Text>
              </View>
              {e.active ? (
                <Pill text={roleLabel[e.role]} color={e.role === 'gerente' ? colors.gold : e.role === 'caixa' ? colors.teal : colors.novo} />
              ) : (
                <Pill text="inativo" color={colors.danger} />
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
            </Pressable>
          ))
        )}

        <Text style={s.footnote}>
          Funcionário que sai é desativado, não apagado — os pedidos que ele lançou continuam
          com o nome dele no histórico.
        </Text>
      </ScrollView>

      <Fab label="Funcionário" onPress={() => setDraft({ ...EMPTY })} />

      <FormSheet
        visible={draft !== null}
        title={draft?.id ? 'Editar funcionário' : 'Novo funcionário'}
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
          label="Usuário do login"
          value={draft?.username || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, username: t } : d))}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!draft?.id}
          style={draft?.id ? { opacity: 0.6 } : undefined}
        />
        <Field
          label={draft?.id ? 'Nova senha (deixe vazio pra manter)' : 'Senha'}
          value={draft?.password || ''}
          onChangeText={(t) => setDraft((d) => (d ? { ...d, password: t } : d))}
          secureTextEntry
          autoCapitalize="none"
          placeholder="mínimo 6 caracteres"
        />

        <Text style={s.fieldLabel}>Cargo</Text>
        <View style={s.roles}>
          {ROLES.map((r) => {
            const on = draft?.role === r;
            return (
              <Pressable
                key={r}
                onPress={() => setDraft((d) => (d ? { ...d, role: r } : d))}
                style={({ pressed }) => [s.role, on && s.roleOn, pressed && { opacity: 0.7 }]}
              >
                <Text style={[s.roleText, on && { color: colors.text }]}>{roleLabel[r]}</Text>
              </Pressable>
            );
          })}
        </View>

        {draft?.id ? (
          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Ativo (pode entrar no PDV)</Text>
            <Switch
              value={!!draft?.active}
              onValueChange={(v) => setDraft((d) => (d ? { ...d, active: v } : d))}
              trackColor={{ true: colors.gold + '77', false: colors.border }}
              thumbColor={draft?.active ? colors.gold : colors.textDim}
            />
          </View>
        ) : null}
      </FormSheet>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: 96 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  rowOff: { opacity: 0.55 },
  name: { color: colors.text, fontSize: 15, fontWeight: '600' },
  you: { color: colors.goldLight, fontSize: 12, fontWeight: '400' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 2 },

  footnote: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginTop: space.lg },

  fieldLabel: {
    color: colors.textDim, fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  roles: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  role: {
    flex: 1, alignItems: 'center',
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingVertical: 11,
  },
  roleOn: { borderColor: colors.gold, backgroundColor: colors.gold + '14' },
  roleText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  switchLabel: { color: colors.text, fontSize: 14, flex: 1 },
});
