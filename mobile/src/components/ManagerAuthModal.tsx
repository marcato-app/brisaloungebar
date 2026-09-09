import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorBox, Field } from '../ui';
import { colors, radius, space } from '../theme';

interface Props {
  visible: boolean;
  message: string;
  onCancel: () => void;
  /** Recebe as credenciais do gerente; se rejeitar, o erro fica no modal e
   *  dá pra tentar de novo sem refazer o fluxo. */
  onConfirm: (username: string, password: string) => Promise<void>;
}

/**
 * Pede usuário e senha de um gerente pra autorizar algo sensível (hoje só
 * cancelar item). O garçom continua logado — a credencial do gerente é
 * usada só naquela chamada, e o servidor registra quem autorizou.
 */
export default function ManagerAuthModal({ visible, message, onCancel, onConfirm }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setUsername('');
      setPassword('');
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const confirm = async () => {
    if (!username.trim() || !password) {
      setError('Preencha usuário e senha');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(username.trim(), password);
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
          <Pressable style={s.box} onPress={() => {}}>
            <View style={s.titleRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.goldLight} />
              <Text style={s.title}>Autorização de gerência</Text>
            </View>
            <Text style={s.message}>{message}</Text>
            {error ? <ErrorBox message={error} /> : null}
            <Field
              label="Usuário do gerente"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!busy}
            />
            <Field
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!busy}
              onSubmitEditing={() => void confirm()}
            />
            <View style={s.actions}>
              <Button title="Cancelar" variant="secondary" onPress={onCancel} disabled={busy} style={{ flex: 1 }} />
              <Button title="Confirmar" onPress={() => void confirm()} loading={busy} style={{ flex: 1 }} />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: space.lg },
  box: {
    backgroundColor: colors.card2,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg,
    padding: space.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  title: { color: colors.goldLight, fontSize: 17, fontWeight: '700' },
  message: { color: colors.textDim, fontSize: 13, lineHeight: 18, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.md },
});
