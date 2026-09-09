import React from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps,
  TextStyle, View, ViewStyle, StyleProp, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, mono, radius, space, statusColor } from './theme';
import { initials } from './format';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ texto */

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={s.title}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.muted, style]}>{children}</Text>;
}

/** Número em monoespaçada — preço, mesa, quantidade. Alinha coluna e não
 *  "dança" quando o valor muda no meio do movimento. */
export function Mono({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.mono, style]}>{children}</Text>;
}

export function SectionHead({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  return (
    <View style={s.sectionHead}>
      <Ionicons name={icon} size={17} color={colors.gold} />
      <Text style={s.sectionHeadText}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/* --------------------------------------------------------------- estrutura */

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.gold} />
      <Text style={[s.muted, { marginTop: space.md }]}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, message }: { icon: IconName; message: string }) {
  return (
    <View style={s.center}>
      <Ionicons name={icon} size={34} color={colors.textDim} style={{ opacity: 0.5 }} />
      <Text style={[s.muted, { marginTop: space.md, textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
      <Text style={s.errorText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={s.errorRetry}>Tentar de novo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------------------------------------- controles */

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style }: ButtonProps) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        isPrimary && s.btnPrimary,
        !isPrimary && s.btnSecondary,
        isDanger && s.btnDanger,
        off && s.btnOff,
        pressed && !off && s.btnPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.black : colors.text} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={16} color={isPrimary ? colors.black : isDanger ? colors.danger : colors.text} />
          ) : null}
          <Text style={[s.btnText, isPrimary && s.btnTextPrimary, isDanger && s.btnTextDanger]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
}

export function Field({ label, style, ...rest }: FieldProps) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textDim}
        {...rest}
        style={[s.input, style]}
      />
    </View>
  );
}

/* -------------------------------------------------------------------- pills */

export function Pill({ text, color = colors.textDim }: { text: string; color?: string }) {
  return (
    <View style={[s.pill, { backgroundColor: color + '22' }]}>
      <Text style={[s.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <Pill text={status} color={statusColor[status] || colors.textDim} />;
}

/** Bolinha com as iniciais — mesma linguagem visual de Clientes/Funcionários
 *  no PDV web. A cor sai do próprio nome, então a mesma pessoa tem sempre a
 *  mesma cor sem precisar guardar nada. */
const AVATAR_COLORS = [colors.gold, colors.teal, colors.novo, colors.aguardando, colors.orange, colors.pink, colors.ok];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const color = avatarColor(name);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '33' }]}>
      <Text style={{ color, fontWeight: '700', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ estilos */

const s = StyleSheet.create({
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  muted: { color: colors.textDim, fontSize: 13 },
  mono: {
    color: colors.text,
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({ ios: mono.ios, android: mono.android, default: mono.default }),
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl, marginBottom: space.md },
  sectionHeadText: { color: colors.text, fontSize: 15, fontWeight: '600' },

  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
  },

  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.xxl },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.danger + '1a',
    borderColor: colors.danger + '55',
    borderWidth: 1, borderRadius: radius.md,
    padding: space.md, marginBottom: space.md,
  },
  errorText: { color: colors.text, flex: 1, fontSize: 13 },
  errorRetry: { color: colors.danger, fontWeight: '700', fontSize: 13 },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    paddingVertical: 14, paddingHorizontal: space.lg,
    borderRadius: radius.md, borderWidth: 1,
  },
  btnPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  btnSecondary: { backgroundColor: 'transparent', borderColor: colors.border },
  btnDanger: { borderColor: colors.danger + '77' },
  btnOff: { opacity: 0.45 },
  btnPressed: { opacity: 0.8 },
  btnText: { color: colors.text, fontWeight: '600', fontSize: 15 },
  btnTextPrimary: { color: colors.black, fontWeight: '700' },
  btnTextDanger: { color: colors.danger },

  fieldLabel: {
    color: colors.textDim, fontSize: 11, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.blackSoft,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 13,
    color: colors.text, fontSize: 16,
  },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  pillText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
});

export { s as uiStyles };

/* ---------------------------------------------------------------------- fab */

/**
 * Botão flutuante de "novo". Fica no canto de baixo à direita porque é onde
 * o polegar alcança segurando o celular com uma mão só — que é como o garçom
 * usa isto, com a outra mão carregando bandeja.
 */
export function Fab({ icon = 'add', label, onPress }: { icon?: IconName; label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [fab.wrap, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color={colors.black} />
      {label ? <Text style={fab.label}>{label}</Text> : null}
    </Pressable>
  );
}

const fab = StyleSheet.create({
  wrap: {
    position: 'absolute', right: space.lg, bottom: space.xl,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: space.lg,
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  label: { color: colors.black, fontWeight: '700', fontSize: 15 },
});

/* --------------------------------------------------------------- busca */

export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder: string }) {
  return (
    <View style={search.wrap}>
      <Ionicons name="search" size={17} color={colors.textDim} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        style={search.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10}>
          <Ionicons name="close-circle" size={17} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const search = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.blackSoft,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 11 },
});
