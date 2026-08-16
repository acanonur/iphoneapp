/**
 * The small set of building blocks every screen is made of.
 */

import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, initials, radius, spacing, typography } from './theme.js';

export function Screen({
  children,
  scroll = false,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}) {
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: spacing.lg, paddingBottom: spacing.xxl * 2 }, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: spacing.lg }, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {content}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[typography.title, { marginBottom: spacing.md }]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <Text style={[typography.heading, { marginBottom: spacing.sm }, style]}>{children}</Text>;
}

export function Muted({ children, numberOfLines }: { children: ReactNode; numberOfLines?: number }) {
  return (
    <Text style={typography.small} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.accent, fg: '#0B0E14' },
    secondary: { bg: colors.surfaceRaised, fg: colors.text },
    danger: { bg: colors.danger, fg: '#180C0A' },
    ghost: { bg: 'transparent', fg: colors.accent },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'ghost' && { paddingHorizontal: spacing.sm },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={{ color: palette.fg, fontWeight: '600', fontSize: 15 }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={[typography.small, { marginBottom: spacing.xs }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 96, textAlignVertical: 'top' }, props.style]}
      />
      {hint ? (
        <Text style={[typography.tiny, { marginTop: spacing.xs }]} numberOfLines={3}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** A coloured bubble with someone's initials — used for "who added this". */
export function Avatar({ name, color, size = 26 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#0B0E14', fontWeight: '700', fontSize: size * 0.42 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  tint,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: tint ?? colors.accentSoft, borderColor: tint ?? colors.accent },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.text : colors.textMuted,
          fontSize: 13,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Text style={typography.subheading}>{title}</Text>
      <Text style={[typography.small, { textAlign: 'center', maxWidth: 320 }]}>{body}</Text>
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

export function Row({
  children,
  gap = spacing.sm,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

/** A tick box big enough to hit while pushing a trolley. */
export function CheckCircle({
  checked,
  onPress,
  color = colors.accent,
}: {
  checked: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.checkTarget}>
      <View
        style={[
          styles.check,
          checked && { backgroundColor: color, borderColor: color },
        ]}
      >
        {checked ? <Text style={{ color: '#0B0E14', fontWeight: '900', fontSize: 14 }}>✓</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardPressed: { backgroundColor: colors.surfaceRaised },
  button: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkTarget: { padding: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
