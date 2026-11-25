/**
 * Meze's building blocks. Every screen is assembled from these, so the look of
 * the app lives here and in `theme.ts`.
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Category } from '../model/types';
import { CategoryGlyph, CheckIcon, MinusIcon, PlusIcon } from './icons';
import { categoryColors, colors, elevation, fonts, radius, spacing, type } from './theme';

/** A full screen on the cream ground, safe from the notch. */
export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  padded?: boolean;
}) {
  const padding = padded ? spacing.lg : 0;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ padding, paddingBottom: spacing.xxl * 2 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** The big screen title, with an optional line under it and actions at the right. */
export function Header({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginBottom: spacing.lg }}>
      <View style={{ flex: 1 }}>
        <Text style={type.title}>{title}</Text>
        {subtitle ? <Text style={[type.small, { marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** A small label above a group. */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.label, { marginBottom: spacing.sm }, style]}>{children}</Text>;
}

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...elevation.card,
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
      {children}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  /** primary: bottle green. quiet: a soft fill. ghost: text only. danger: for deleting. */
  variant?: 'primary' | 'quiet' | 'ghost' | 'danger';
  icon?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    quiet: { bg: colors.surfaceAlt, fg: colors.text },
    ghost: { bg: 'transparent', fg: colors.accentText },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          minHeight: 50,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          backgroundColor: palette.bg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon}
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: palette.fg }}>{label}</Text>
    </Pressable>
  );
}

/** A round button holding one icon. */
export function IconButton({
  children,
  onPress,
  label,
  tone = 'quiet',
  size = 44,
}: {
  children: ReactNode;
  onPress: () => void;
  /** What a screen reader says. */
  label: string;
  tone?: 'quiet' | 'plain' | 'primary';
  size?: number;
}) {
  const bg = tone === 'primary' ? colors.accent : tone === 'quiet' ? colors.surfaceAlt : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** A filter chip. The selected one is solid ink. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'ink',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  /** What "selected" looks like: solid ink for filters, saffron for things you have. */
  tone?: 'ink' | 'mark' | 'accent';
}) {
  const on = { ink: [colors.text, colors.bg], mark: [colors.mark, colors.onMark], accent: [colors.accent, colors.onAccent] }[
    tone
  ] as [string, string];
  const bg = selected ? on[0] : colors.surfaceAlt;
  const fg = selected ? on[1] : colors.text;
  const body = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        minHeight: 36,
        borderRadius: radius.pill,
        backgroundColor: bg,
      }}
    >
      {icon}
      <Text style={{ fontFamily: fonts.semi, fontSize: 14, color: fg }}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** A row of chips that scrolls sideways and bleeds to the screen edges. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.lg, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
    >
      {children}
    </ScrollView>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Two or three exclusive modes. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  stretch = false,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  stretch?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        padding: 4,
        alignSelf: stretch ? 'stretch' : 'flex-start',
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              {
                flex: stretch ? 1 : undefined,
                paddingVertical: 9,
                paddingHorizontal: 18,
                borderRadius: radius.pill,
                alignItems: 'center',
              },
              active && [{ backgroundColor: colors.surface }, elevation.card],
            ]}
          >
            <Text
              style={{
                fontFamily: active ? fonts.bold : fonts.semi,
                fontSize: 14,
                color: active ? colors.text : colors.textMuted,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  left,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; hint?: string; left?: ReactNode; containerStyle?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Label>{label}</Label> : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: props.multiline ? 'flex-start' : 'center',
          gap: spacing.sm,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.divider,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md + 2,
        }}
      >
        {left}
        <TextInput
          placeholderTextColor={colors.textFaint}
          {...props}
          style={[
            {
              flex: 1,
              minHeight: props.multiline ? 120 : 50,
              paddingVertical: props.multiline ? spacing.md : 0,
              textAlignVertical: props.multiline ? 'top' : 'center',
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: 16,
              lineHeight: props.multiline ? 23 : undefined,
            },
            props.style,
          ]}
        />
      </View>
      {hint ? <Text style={[type.small, { marginTop: 6 }]}>{hint}</Text> : null}
    </View>
  );
}

/** A round tick: saffron ring empty, green when done. */
export function Tick({ checked, onPress, label }: { checked: boolean; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      hitSlop={10}
      style={{
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: checked ? colors.success : colors.divider,
        backgroundColor: checked ? colors.success : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <CheckIcon size={15} color={colors.surface} strokeWidth={3} /> : null}
    </Pressable>
  );
}

/** Minus, a number, plus — for servings. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** What is being counted, for screen readers. */
  label: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        padding: 3,
      }}
    >
      <IconButton
        label={`${label} −`}
        tone="plain"
        size={38}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <MinusIcon size={18} color={value <= min ? colors.textFaint : colors.text} />
      </IconButton>
      <Text
        style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.text, minWidth: 30, textAlign: 'center' }}
        accessibilityLabel={`${label}: ${value}`}
      >
        {value}
      </Text>
      <IconButton
        label={`${label} +`}
        tone="plain"
        size={38}
        onPress={() => onChange(Math.min(max, value + 1))}
      >
        <PlusIcon size={18} color={value >= max ? colors.textFaint : colors.text} />
      </IconButton>
    </View>
  );
}

/** The coloured square that stands in for a photograph. */
export function CategoryTile({
  category,
  size = 64,
  rounded = radius.md,
}: {
  category: Category;
  size?: number;
  rounded?: number;
}) {
  const tone = categoryColors[category];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        backgroundColor: tone.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CategoryGlyph category={category} size={Math.round(size * 0.5)} color={tone.ink} strokeWidth={1.8} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl * 1.5, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.small, { textAlign: 'center', maxWidth: 320, fontSize: 15, lineHeight: 22 }]}>{body}</Text>
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

/** A hairline between rows inside a card. */
export function Hairline() {
  return <View style={{ height: 1, backgroundColor: colors.dividerSoft }} />;
}
