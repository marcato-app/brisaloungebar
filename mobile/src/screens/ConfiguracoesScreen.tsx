import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { API_URL } from '../config';
import { useApi, useAction } from '../hooks';
import { Button, ErrorBox, Field, Loading, SectionHead } from '../ui';
import { colors, radius, roleLabel, space } from '../theme';
import { useSession } from '../session';

interface Form {
  business_name: string;
  cnpj: string;
  address: string;
  phone: string;
  receipt_footer: string;
  table_count: string;
}

const EMPTY: Form = { business_name: '', cnpj: '', address: '', phone: '', receipt_footer: '', table_count: '12' };

export default function ConfiguracoesScreen() {
  const settings = useApi<{ settings: Record<string, string> }>('/api/pdv/settings');
  const { run, busy, error } = useAction();
  const { me, logout } = useSession();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Preenche a partir do que veio do servidor, sem sobrescrever o que o
  // gerente já está digitando: só copia quando o form ainda está intocado.
  const raw = settings.data?.settings;
  useEffect(() => {
    if (!raw) return;
    setForm({
      business_name: raw.business_name || '',
      cnpj: raw.cnpj || '',
      address: raw.address || '',
      phone: raw.phone || '',
      receipt_footer: raw.receipt_footer || '',
      table_count: raw.table_count || '12',
    });
  }, [raw]);

  const set = (key: keyof Form) => (t: string) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: t }));
  };

  const save = () => {
    const n = Number(form.table_count);
    if (!Number.isInteger(n) || n < 1 || n > 60) {
      setLocalError('Número de mesas precisa ser um inteiro entre 1 e 60');
      return;
    }
    setLocalError(null);
    void run(
      async () => {
        await api('/api/pdv/settings', { method: 'PUT', body: { ...form, table_count: n } });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      () => {
        setSaved(true);
        settings.reload();
      }
    );
  };

  if (settings.loading && !settings.data) return <Loading />;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={false} onRefresh={settings.reload} tintColor={colors.gold} />}
    >
      {settings.error ? <ErrorBox message={settings.error} onRetry={settings.reload} /> : null}
      {localError || error ? <ErrorBox message={localError || error!} /> : null}

      <Text style={s.intro}>
        Estes dados saem impressos no cupom de venda. O número de mesas desenha o mapa de
        comandas — aqui e no PDV do navegador, os dois leem daqui.
      </Text>

      <Field label="Nome do negócio" value={form.business_name} onChangeText={set('business_name')} />
      <Field label="CNPJ" value={form.cnpj} onChangeText={set('cnpj')} keyboardType="numbers-and-punctuation" />
      <Field label="Endereço" value={form.address} onChangeText={set('address')} />
      <Field label="Telefone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field
        label="Rodapé do cupom"
        value={form.receipt_footer}
        onChangeText={set('receipt_footer')}
        multiline
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />
      <Field
        label="Número de mesas"
        value={form.table_count}
        onChangeText={set('table_count')}
        keyboardType="number-pad"
      />

      <Button
        title={saved ? 'Salvo' : 'Salvar configurações'}
        icon={saved ? 'checkmark-circle' : 'save-outline'}
        onPress={save}
        loading={busy}
      />

      <SectionHead icon="phone-portrait-outline" title="Este aparelho" />
      <View style={s.info}>
        <InfoLine label="Conectado como" value={me ? `${me.name} (${roleLabel[me.role]})` : '—'} />
        <InfoLine label="Servidor" value={API_URL.replace(/^https?:\/\//, '')} />
      </View>

      <Button
        title="Sair da conta"
        icon="log-out-outline"
        variant="secondary"
        onPress={() => void logout()}
        style={{ marginTop: space.md }}
      />
    </ScrollView>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoLine}>
      <Ionicons name="ellipse" size={6} color={colors.gold} />
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  content: { padding: space.lg, paddingBottom: space.xxl },

  intro: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: space.lg },

  info: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    padding: space.md, gap: space.sm,
  },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoLabel: { color: colors.textDim, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
});
