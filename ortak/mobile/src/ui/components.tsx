/**
 * The building blocks, in Modernist.
 *
 * What changed from the first design, and why:
 *
 *  - **Cards became rules.** Most of what used to be a bordered, rounded card
 *    is now a row separated by a hairline, inside a section separated by a 2px
 *    rule. `Card` still exists but is now a flat surface panel with no border
 *    and no radius, used only for notices.
 *  - **Round became square.** Avatars are squares of solid ink; tick boxes are
 *    squares that fill with the accent.
 *  - **Pills became tabs and tags.** Filters that used to be pill chips are
 *    either a segmented control (two exclusive modes) or flush-left text tabs
 *    with a 2px underline (many options).
 *  - **Buttons run flush left** with the icon pushed to the far edge, which is
 *    what makes a column of them line up with the labels above them.
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
import { colors, fonts, initials, rules, spacing, typography } from './theme.js';

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
 * The screen title bar: an 800-weight title with the household's member
 * squares at the right, over a 2px rule.
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
        <View style={{ flexDirection: 'row', gap: 4, paddingBottom: 4 }}>
          {members.map((m) => (
            <MemberSquare key={m.id} name={m.name} color={m.color} size={18} />
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

/** Uppercase, tracked-out section label — the system's h6. */
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

/** A flat surface panel. Used for notices, not for every row. */
export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  // Cards in this system are flat fields of surface colour with no outline, so
  // a caller's `borderColor` had nothing to colour and was silently dropped —
  // the offline warning, the error notice and the accented summaries all looked
  // exactly like ordinary cards. A heavy left rule is how this design system
  // marks something out, so that is what a colour now buys.
  const marked: ViewStyle | null =
    style?.borderColor !== undefined && style.borderWidth === undefined
      ? { borderLeftWidth: 3, borderLeftColor: style.borderColor }
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

/** A notice with an accent kicker above it — the system's card-kicker pattern. */
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
  /** Pushed to the far edge, per the system's flush-left button rule. */
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
    primary: { bg: colors.accent, fg: colors.bg, border: 'transparent' },
    secondary: { bg: 'transparent', fg: colors.text, border: colors.divider },
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
          justifyContent: block ? 'flex-start' : 'center',
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
        <View style={{ marginLeft: block ? 'auto' : 6 }}>
          <ActivityIndicator color={palette.fg} size="small" />
        </View>
      ) : icon ? (
        <View style={{ marginLeft: block ? 'auto' : 6 }}>{icon}</View>
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

/** A square of solid ink with the member's initials — the system's avatar. */
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
    <View style={{ width: size, height: size, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontFamily: fonts.heading,
          fontSize: Math.round(size * 0.45),
          color: colors.bg,
          lineHeight: Math.round(size * 0.55),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

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
    ? { bg: colors.accent, fg: colors.bg, border: colors.accent }
    : variant === 'accent'
      ? { bg: colors.accent100, fg: colors.accent800, border: 'transparent' }
      : variant === 'outline'
        ? { bg: 'transparent', fg: colors.accent, border: colors.accent }
        : { bg: colors.neutral100, fg: colors.text, border: colors.divider };

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

/** Two or three exclusive modes — the system's segmented control. */
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
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segOpt,
              index > 0 && { borderLeftWidth: 1, borderLeftColor: colors.divider },
              active && { backgroundColor: colors.accent },
              !active && pressed && { backgroundColor: colors.neutral200 },
            ]}
          >
            <Text
              style={{
                fontFamily: fonts.body,
                fontSize: 13,
                lineHeight: 17,
                color: active ? colors.bg : colors.text,
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
 * Many options as flush-left text with a 2px accent underline on the active
 * one. Scrolls horizontally when the labels outgrow the width.
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
      contentContainerStyle={{ gap: 18 }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            onPress={() => onChange(tab.value)}
            style={[
              styles.textTab,
              { borderBottomColor: active ? colors.accent : 'transparent' },
            ]}
          >
            <Text
              style={{
                fontFamily: active ? fonts.headingSemi : fonts.body,
                fontSize: 13,
                lineHeight: 17,
                color: active ? colors.text : colors.textMuted,
              }}
            >
              {tab.label}
            </Text>
            {tab.count ? (
              <Text style={{ fontFamily: fonts.heading, fontSize: 10, color: colors.accent700 }}>
                {tab.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A square tick box that fills with the accent when done. */
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
          borderWidth: 1.5,
          borderColor: checked ? colors.accent : colors.divider,
          backgroundColor: checked ? colors.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? <CheckIcon size={size - 8} color={colors.bg} /> : null}
      </View>
    </Pressable>
  );
}

/** A 2px section rule, or a 1px row rule. */
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

/** Kept for screens not yet restyled; renders the system's row rule. */
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
 * A section: an uppercase heading over a 2px rule, with its rows beneath.
 * This is the shape most of the app is built from now.
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
      <Rule />
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
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: rules.section,
    borderBottomColor: colors.divider,
  },
  card: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm - 4,
    marginBottom: spacing.sm,
  },
  cardPressed: { backgroundColor: colors.neutral300 },
  cardKicker: {
    fontFamily: fonts.heading,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  button: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    minHeight: 44,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: { fontFamily: fonts.heading, fontSize: 14, lineHeight: 18 },
  fieldLabel: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 5,
    color: colors.neutral700,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    alignSelf: 'flex-start',
  },
  tagTappable: { minHeight: 30, justifyContent: 'center' },
  seg: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.divider,
    alignSelf: 'flex-start',
  },
  segOpt: { paddingVertical: 9, paddingHorizontal: 16 },
  tabsTrack: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    marginTop: spacing.md + 2,
  },
  textTab: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: 2,
    marginBottom: -1,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingBottom: 6,
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
