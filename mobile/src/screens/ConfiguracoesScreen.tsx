import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '../api';
import { API_URL } from '../config';
import { useApi, useAction } from '../hooks';
import { formatAgo, elapsedMinutes, formatElapsed } from '../format';
import { Button, ErrorBox, Field, Loading, SectionHead } from '../ui';
import { colors, radius, roleLabel, sectorLabel, space } from '../theme';
import { useSession } from '../session';
import type { Printer } from '../types';

interface Form {
  business_name: string;
  cnpj: string;
  address: string;
  phone: string;
  receipt_footer: string;
  table_count: string;
  printer_bar_cozinha: string;
  printer_tabacaria: string;
}

const EMPTY: Form = {
  business_name: '', cnpj: '', address: '', phone: '', receipt_footer: '', table_count: '12',
  printer_bar_cozinha: '', printer_tabacaria: '',
};

/** Estado das impressoras se atualiza sozinho, mas devagar: é diagnóstico,
 *  não movimento de salão. */
const PRINTER_POLL_MS = 10000;

export default function ConfiguracoesScreen() {
  const settings = useApi<{ settings: Record<string, string> }>('/api/pdv/settings');
  const printers = useApi<{ printers: Printer[] }>('/api/pdv/printers', { pollMs: PRINTER_POLL_MS });
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
      printer_bar_cozinha: raw.printer_bar_cozinha || '',
      printer_tabacaria: raw.printer_tabacaria || '',
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

      <Text style={s.intro}>
        Nome do compartilhamento de cada impressora no Windows. Mudar aqui vale sozinho no PC
        do bar em até um minuto — não precisa mexer em arquivo nenhum lá.
      </Text>
      <Field
        label="Impressora do Bar/Cozinha"
        value={form.printer_bar_cozinha}
        onChangeText={set('printer_bar_cozinha')}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="\\\\localhost\\ELGIN_BAR"
      />
      <Field
        label="Impressora da Tabacaria"
        value={form.printer_tabacaria}
        onChangeText={set('printer_tabacaria')}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="\\\\localhost\\ELGIN_TABACARIA"
      />

      <Button
        title={saved ? 'Salvo' : 'Salvar configurações'}
        icon={saved ? 'checkmark-circle' : 'save-outline'}
        onPress={save}
        loading={busy}
      />

      <SectionHead icon="print-outline" title="Estado das impressoras" />
      {printers.error ? <ErrorBox message={printers.error} onRetry={printers.reload} /> : null}
      {(printers.data?.printers || []).map((p) => (
        <PrinterCard key={p.sector} printer={p} />
      ))}

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

/**
 * O PDV não fala com a Elgin — quem fala é a ponte, rodando no PC do bar. O
 * que dá pra mostrar aqui é o que a ponte conta: quando apareceu pela última
 * vez, quando imprimiu, quantos pedidos estão parados e qual foi o erro. É o
 * bastante pra responder a pergunta das onze da noite: a impressora está
 * viva, ou o pedido não vai sair?
 */
function PrinterCard({ printer }: { printer: Printer }) {
  const color = printer.online ? colors.ok : colors.danger;
  return (
    <View style={[s.printer, { borderLeftColor: color }]}>
      <View style={s.printerTop}>
        <View style={[s.printerDot, { backgroundColor: color }]} />
        <Text style={s.printerName}>{sectorLabel[printer.sector]}</Text>
        <Text style={[s.printerState, { color }]}>
          {printer.online ? 'online' : `sem sinal ${formatAgo(printer.secondsSinceSeen)}`}
        </Text>
      </View>

      <Text style={s.printerMeta}>
        {printer.queueCount === 0
          ? 'nada na fila'
          : `${printer.queueCount} ${printer.queueCount === 1 ? 'pedido esperando' : 'pedidos esperando'}`}
        {' · '}
        {printer.lastPrintedAt
          ? `imprimiu há ${formatElapsed(elapsedMinutes(printer.lastPrintedAt))}`
          : 'nunca imprimiu'}
      </Text>
      <Text style={s.printerShare} numberOfLines={1}>
        {printer.share || 'sem impressora configurada'}
      </Text>

      {printer.lastError ? (
        <View style={s.printerError}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
          <Text style={s.printerErrorText}>{printer.lastError}</Text>
        </View>
      ) : null}
      {!printer.online ? (
        <Text style={s.printerHint}>
          Confira se o PC do bar está ligado e com o programa de impressão aberto.
        </Text>
      ) : null}
    </View>
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
  printer: {
    backgroundColor: colors.card,
    borderColor: colors.border, borderWidth: 1, borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: space.md, marginBottom: space.sm,
  },
  printerTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  printerDot: { width: 9, height: 9, borderRadius: 4.5 },
  printerName: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  printerState: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  printerMeta: { color: colors.textDim, fontSize: 12, marginTop: 5 },
  printerShare: { color: colors.textDim, fontSize: 11, marginTop: 2, opacity: 0.8 },
  printerError: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  printerErrorText: { color: colors.danger, fontSize: 12, flex: 1 },
  printerHint: { color: colors.textDim, fontSize: 11, lineHeight: 15, marginTop: 6 },

  infoLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoLabel: { color: colors.textDim, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
});
