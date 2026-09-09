import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorBox, Field } from '../ui';
import { colors, radius, space } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  keyboardType?: 'default' | 'number-pad';
  onCancel: () => void;
  /** Se rejeitar, o erro aparece dentro do modal e a pessoa corrige sem
   *  perder o que digitou — igual ao modal de gerência do PDV web. */
  onConfirm: (value: string) => Promise<void>;
}

export default function PromptModal({
  visible, title, message, label, placeholder, initialValue = '',
  confirmLabel = 'Confirmar', keyboardType = 'default', onCancel, onConfirm,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reabrir o modal precisa começar limpo — senão volta com o texto e o erro
  // da vez anterior.
  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError(null);
      setBusy(false);
    }
  }, [visible, initialValue]);

  const confirm = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Informe ' + label.toLowerCase());
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.backdrop} onPress={busy ? undefined : onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Pressable interno com onPress vazio: toque dentro da caixa não
              pode fechar o modal junto com o toque no fundo. */}
          <Pressable style={s.box} onPress={() => {}}>
            <Text style={s.title}>{title}</Text>
            {message ? <Text style={s.message}>{message}</Text> : null}
            {error ? <ErrorBox message={error} /> : null}
            <Field
              label={label}
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              autoFocus
              keyboardType={keyboardType}
              returnKeyType="done"
              onSubmitEditing={() => void confirm()}
              editable={!busy}
            />
            <View style={s.actions}>
              <Button title="Cancelar" variant="secondary" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />
              <Button title={confirmLabel} onPress={() => void confirm()} loading={busy} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', padding: space.lg,
  },
  box: {
    backgroundColor: colors.card2,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg,
    padding: space.lg,
  },
  title: { color: colors.goldLight, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  message: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.md },
});
