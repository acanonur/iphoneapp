/**
 * The building blocks of the "Two Inks" system.
 *
 * Every screen is assembled from these, which is what lets the look of the
 * whole app live in two files (this one and `theme.ts`):
 *
 *  - **Cards carry groups.** A white, rounded card a step above the oat ground
 *    holds anything that belongs together; rows inside it are split by a soft
 *    hairline. Nothing is boxed in by heavy rules.
 *  - **People are circles in their own ink.** Coral, teal, plum… by join order.
 *  - **Modes are a segmented pill; filters are chips.** The active chip is
 *    solid ink, so it is findable at a glance without using either person's
 *    colour for something that is not about a person.
 *  - **Buttons are centred and rounded.** Coral for the one primary action on a
 *    screen, a quiet fill for everything else.
 *  - **Done is green.** A tick fills with the success colour, not the accent.
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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckIcon } from './icons.js';
import { colors, elevation, fonts, initials, radius, rules, spacing, typography } from './theme.js';

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

/**
 * The screen title bar: the serif title with the household's avatars at the
 * right, overlapping the way people in one photo do.
 */
export function ScreenHeader({
  title,
  members,
  right,
}: {
  title: string;
  members?: { id: string; name: string; color: string }[];
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Text style={[typography.title, { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {right}
      {members && members.length > 0 ? (
        <View style={{ flexDirection: 'row', paddingBottom: 3 }}>
          {members.map((m, index) => (
            <View
              key={m.id}
              style={{
                marginLeft: index === 0 ? 0 : -8,
                borderWidth: 2,
                borderColor: colors.bg,
                borderRadius: radius.pill,
              }}
            >
              <MemberSquare name={m.name} color={m.color} size={28} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[typography.title, { marginBottom: spacing.md }]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[typography.heading, { marginBottom: spacing.sm }, style]}>{children}</Text>;
}

/** A small, muted section label. */
export function Kicker({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return <Text style={[typography.kicker, style]}>{children}</Text>;
}

export function Muted({ children, numberOfLines }: { children: ReactNode; numberOfLines?: number }) {
  return (
    <Text style={typography.small} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** A rounded surface a step above the ground. */
export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  // A caller's `borderColor` marks a card out — the offline warning, an error,
  // an accented summary. On a rounded card that reads best as a full outline in
  // that colour, so that is what a colour buys.
  const marked: ViewStyle | null =
    style?.borderColor !== undefined && style.borderWidth === undefined
      ? { borderWidth: 1.5, borderColor: style.borderColor }
      : null;

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style, marked]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style, marked]}>{children}</View>;
}

/** A notice with a small accent label above it. */
export function NoticeCard({
  kicker,
  children,
  style,
}: {
  kicker: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <Card style={style}>
      <Text style={styles.cardKicker}>{kicker}</Text>
      {typeof children === 'string' ? <Text style={typography.body}>{children}</Text> : children}
    </Card>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  busy = false,
  /** Sits after the label; at the far edge of a full-width button. */
  icon,
  block = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  busy?: boolean;
  icon?: ReactNode;
  block?: boolean;
  style?: ViewStyle;
}) {
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: 'transparent' },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
          justifyContent: block && (icon || busy) ? 'space-between' : 'center',
          width: block ? '100%' : undefined,
        },
        variant === 'ghost' && { paddingHorizontal: spacing.xs },
        style,
      ]}
    >
      {/*
        The label stays while busy. Swapping it out for a bare spinner threw
        away the one thing that says what is happening — several callers pass a
        label like "Searching…" precisely for this moment — and left the button
        jumping between two widths. The spinner takes the icon's place instead.
      */}
      <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
      {busy ? (
        <View style={{ marginLeft: 6 }}>
          <ActivityIndicator color={palette.fg} size="small" />
        </View>
      ) : icon ? (
        <View style={{ marginLeft: 6 }}>{icon}</View>
      ) : null}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  containerStyle,
  ...props
}: TextInputProps & { label?: string; hint?: string; containerStyle?: ViewStyle }) {
  // `style` belongs to the input itself; layout that positions the field as a
  // whole — margins, flex inside a row — has to reach the wrapper, which is why
  // `containerStyle` exists. Callers passing `{ marginBottom: 0 }` as `style`
  // were changing nothing, because the margin lives out here.
  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.neutral500}
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

/**
 * A circle in the member's ink with their initials. The name is historical —
 * it was a square in the previous design — and `Avatar` is the same component.
 */
export function MemberSquare({
  name,
  color,
  size = 20,
}: {
  name: string;
  color: string;
  size?: number;
}) {
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
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: Math.round(size * 0.4),
          color: colors.onAccent,
          lineHeight: Math.round(size * 0.55),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

export const Avatar = MemberSquare;

export function Tag({
  label,
  selected = false,
  onPress,
  variant = 'neutral',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: 'neutral' | 'accent' | 'outline';
}) {
  const palette = selected
    ? { bg: colors.text, fg: colors.bg, border: colors.text }
    : variant === 'accent'
      ? { bg: colors.accent100, fg: colors.accent800, border: 'transparent' }
      : variant === 'outline'
        ? { bg: 'transparent', fg: colors.accent, border: colors.accent }
        : { bg: colors.surfaceAlt, fg: colors.text, border: 'transparent' };

  const body = (
    <Text
      style={{
        fontFamily: selected ? fonts.headingSemi : fonts.body,
        fontSize: 12,
        lineHeight: 16,
        color: palette.fg,
      }}
    >
      {label}
    </Text>
  );

  if (!onPress) {
    return (
      <View style={[styles.tag, { backgroundColor: palette.bg, borderColor: palette.border }]}>{body}</View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tag,
        styles.tagTappable,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      {body}
    </Pressable>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Two or three exclusive modes, as a pill with a white thumb on the active one. */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.seg, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segOpt,
              active && [{ backgroundColor: colors.surface }, elevation.card],
              !active && pressed && { opacity: 0.6 },
            ]}
          >
            <Text
              style={{
                fontFamily: active ? fonts.heading : fonts.headingSemi,
                fontSize: 14,
                lineHeight: 18,
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

export interface TextTab<T extends string> {
  value: T;
  label: string;
  /** Shown small and accent-coloured after the label. */
  count?: number;
}

/**
 * Many options as a row of chips; the active one is solid ink. Scrolls
 * horizontally when the labels outgrow the width.
 */
export function TextTabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: readonly TextTab<T>[];
  value: T | null;
  onChange: (value: T) => void;
  style?: ViewStyle;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsTrack, style]}
      contentContainerStyle={{ gap: 8 }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[
              styles.textTab,
              { backgroundColor: active ? colors.text : colors.surfaceAlt },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.headingSemi,
                fontSize: 13,
                lineHeight: 17,
                color: active ? colors.bg : colors.textMuted,
              }}
            >
              {tab.label}
            </Text>
            {tab.count ? (
              <Text
                style={{
                  fontFamily: fonts.heading,
                  fontSize: 11,
                  color: active ? colors.bg : colors.accent700,
                }}
              >
                {tab.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A round tick that fills with green when done. */
export function TickBox({
  checked,
  onPress,
  size = 22,
  hitSize = 36,
}: {
  checked: boolean;
  onPress: () => void;
  size?: number;
  /** The tap target around it — 44 on the thumb side of a shopping list. */
  hitSize?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: hitSize,
        height: hitSize,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: -(hitSize - 24) / 2,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.75,
          borderColor: checked ? colors.success : colors.neutral400,
          backgroundColor: checked ? colors.success : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <CheckIcon size={size - 8} color={colors.surface} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

/** A hairline: `section` is the firmer of the two. */
export function Rule({ weight = 'section', style }: { weight?: 'section' | 'row'; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          height: weight === 'section' ? rules.section : rules.row,
          backgroundColor: weight === 'section' ? colors.divider : colors.dividerSoft,
        },
        style,
      ]}
    />
  );
}

/** A row hairline with breathing room either side. */
export function Divider() {
  return <Rule weight="row" style={{ marginVertical: spacing.md }} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <View style={{ paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Text style={typography.heading}>{title}</Text>
      <Text style={[typography.small, { maxWidth: 340 }]}>{body}</Text>
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
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
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

/**
 * A section: a quiet label with its rows beneath. Sections are separated by
 * space rather than by a rule.
 */
export function Section({
  label,
  meta,
  children,
  style,
}: {
  label: string;
  meta?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginTop: spacing.xl }, style]}>
      <View style={styles.sectionHead}>
        <Kicker>{label}</Kicker>
        {meta ? <Text style={typography.tiny}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** One row inside a section, closed with a hairline. */
export function ListRow({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const inner = <View style={[styles.listRow, style]}>{children}</View>;
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}>
      {inner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: 10,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm - 2,
    marginBottom: spacing.md,
    ...elevation.card,
  },
  cardPressed: { backgroundColor: colors.neutral100 },
  cardKicker: {
    fontFamily: fonts.heading,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    color: colors.accent700,
  },
  button: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg + 2,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: { fontFamily: fonts.heading, fontSize: 15, lineHeight: 19 },
  fieldLabel: {
    fontFamily: fonts.headingSemi,
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 6,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    minHeight: 48,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  tagTappable: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 12 },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    alignSelf: 'flex-start',
  },
  segOpt: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: radius.pill },
  tabsTrack: {
    marginTop: spacing.md + 2,
    flexGrow: 0,
  },
  textTab: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: rules.row,
    borderBottomColor: colors.dividerSoft,
  },
});
