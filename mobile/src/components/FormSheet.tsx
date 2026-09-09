import React from 'react';
import {
  KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, ErrorBox } from '../ui';
import { colors, radius, space } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** Ação destrutiva/secundária no rodapé (desativar funcionário, por ex.). */
  extra?: React.ReactNode;
}

/**
 * Folha de formulário que sobe de baixo — cadastro e edição usam a mesma,
 * pra que "novo cliente" e "editar cliente" nunca fiquem com campos
 * diferentes por descuido.
 */
export default function FormSheet({
  visible, title, children, onCancel, onSubmit, submitLabel = 'Salvar', busy, error, extra,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={busy ? undefined : onCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.sheet}>
            <View style={s.grabber} />
            <View style={s.head}>
              <Text style={s.title}>{title}</Text>
              <Pressable onPress={onCancel} hitSlop={10} disabled={busy}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={s.body}>
              {error ? <ErrorBox message={error} /> : null}
              {children}
              {extra}
            </ScrollView>
            <Button title={submitLabel} icon="checkmark" onPress={onSubmit} loading={busy} />
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: colors.card2,
    borderTopColor: colors.border, borderTopWidth: 1,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: space.lg,
    paddingBottom: Platform.OS === 'ios' ? space.xxl : space.lg,
    maxHeight: '88%',
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  body: { marginBottom: space.md },
});
