import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSession } from '../session';
import { useAction } from '../hooks';
import { Button, ErrorBox, Field } from '../ui';
import { colors, radius, space } from '../theme';

export default function LoginScreen() {
  const { login } = useSession();
  const { run, busy, error } = useAction();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    if (!username.trim() || !password) return;
    void run(() => login(username, password));
  };

  return (
    <KeyboardAvoidingView
      style={s.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <View style={s.box}>
          <View style={s.mark}>
            <Ionicons name="business" size={26} color={colors.gold} />
          </View>
          <Text style={s.brand}>
            BRISA <Text style={s.badge}> PDV </Text>
          </Text>
          <Text style={s.sub}>Login de funcionário</Text>

          {error ? <ErrorBox message={error} /> : null}

          <Field
            label="Usuário"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            returnKeyType="next"
          />
          <Field
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          <Button title="Entrar" onPress={submit} loading={busy} disabled={!username.trim() || !password} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.black },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  box: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.xl,
  },
  mark: {
    width: 56, height: 56, borderRadius: 28, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.gold + '22', marginBottom: space.lg,
  },
  brand: {
    color: colors.text, fontSize: 22, fontWeight: '700',
    letterSpacing: 1, textAlign: 'center',
  },
  badge: {
    color: colors.gold, fontSize: 11, fontWeight: '700', letterSpacing: 1,
  },
  sub: {
    color: colors.textDim, fontSize: 13, textAlign: 'center',
    marginTop: 4, marginBottom: space.xl,
  },
});
