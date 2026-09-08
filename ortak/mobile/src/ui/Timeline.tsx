/**
 * The day drawn as a strip of proportional blocks.
 *
 * Borrowed from Structured, whose good idea is that free time should be as
 * visible as booked time. A list tells you what you have on; this tells you
 * that the afternoon is wide open, which is the thing you actually plan around.
 *
 * Blocks are laid out by duration, so a three-hour gap looks like a three-hour
 * gap. Very short blocks get a floor height so a fifteen-minute call is still
 * tappable.
 */

import { Pressable, Text, View } from 'react-native';
import { formatDuration, type DayTimeline, type TimelineBlock } from '../../../shared/src/timeline.js';
import { colors, clockTime, radius, spacing, typography } from './theme.js';

/** Pixels per minute — a 14-hour window comes out around 560pt tall. */
const SCALE = 0.66;
const MIN_HEIGHT = 34;

function blockHeight(block: TimelineBlock): number {
  return Math.max(MIN_HEIGHT, Math.round(block.minutes * SCALE));
}

export function Timeline({
  timeline,
  memberColors = {},
  memberNames = {},
  onPressEvent,
  onPressGap,
}: {
  timeline: DayTimeline;
  /** userId → colour, for other people's commitments. */
  memberColors?: Record<string, string>;
  memberNames?: Record<string, string>;
  onPressEvent?: (eventId: string) => void;
  onPressGap?: (block: TimelineBlock) => void;
}) {
  if (timeline.blocks.length === 0) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <Text style={typography.small}>Nothing scheduled.</Text>
      </View>
    );
  }

  return (
    <View>
      {timeline.allDay.length > 0 ? (
        <View style={{ marginBottom: spacing.sm, gap: spacing.xs }}>
          {timeline.allDay.map((event) => (
            <View
              key={event.id}
              style={{
                backgroundColor: colors.accent100,
                borderRadius: radius.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text style={typography.small}>📌 {event.title}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row' }}>
        {/* The hour rail down the left. */}
        <View style={{ width: 46 }}>
          {timeline.blocks.map((block, index) => (
            <View key={`t-${index}`} style={{ height: blockHeight(block), paddingTop: 2 }}>
              <Text style={typography.tiny}>{clockTime(block.startsAt)}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          {timeline.blocks.map((block, index) => (
            <Block
              key={`b-${index}`}
              block={block}
              memberColors={memberColors}
              memberNames={memberNames}
              onPressEvent={onPressEvent}
              onPressGap={onPressGap}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: spacing.sm, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={typography.tiny}>{formatDuration(timeline.busyMinutes)} committed</Text>
        <Text style={typography.tiny}>{formatDuration(timeline.freeMinutes)} free</Text>
      </View>
    </View>
  );
}

function Block({
  block,
  memberColors,
  memberNames,
  onPressEvent,
  onPressGap,
}: {
  block: TimelineBlock;
  memberColors: Record<string, string>;
  memberNames: Record<string, string>;
  onPressEvent?: (eventId: string) => void;
  onPressGap?: (block: TimelineBlock) => void;
}) {
  const height = blockHeight(block);

  if (block.kind === 'gap') {
    return (
      <Pressable
        onPress={onPressGap ? () => onPressGap(block) : undefined}
        style={({ pressed }) => ({
          height,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.divider,
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={typography.tiny}>
          {formatDuration(block.minutes)} free
          {onPressGap && block.minutes >= 45 ? '  ·  tap to plan something' : ''}
        </Text>
      </Pressable>
    );
  }

  if (block.kind === 'busy') {
    // Someone's own commitment, from their device calendar. Striped down the
    // side in their colour and deliberately quieter than a shared plan.
    const tint = block.ownerId ? (memberColors[block.ownerId] ?? colors.textFaint) : colors.textFaint;
    return (
      <View
        style={{
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          borderLeftWidth: 4,
          borderLeftColor: tint,
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
        }}
      >
        <Text style={typography.small} numberOfLines={1}>
          {block.title ?? 'Busy'}
        </Text>
        {block.ownerId && memberNames[block.ownerId] ? (
          <Text style={typography.tiny}>{memberNames[block.ownerId]}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPressEvent && block.eventId ? () => onPressEvent(block.eventId!) : undefined}
      style={({ pressed }) => ({
        height,
        borderRadius: radius.sm,
        // A clash is the same red, turned up — Modernist has no second hue.
        backgroundColor: block.overlapping ? colors.accent200 : colors.accent100,
        borderLeftWidth: 4,
        borderLeftColor: block.overlapping ? colors.accent700 : (block.color ?? colors.accent),
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={typography.subheading} numberOfLines={1}>
        {block.overlapping ? '⚠︎ ' : ''}
        {block.title}
      </Text>
      <Text style={typography.tiny} numberOfLines={1}>
        {clockTime(block.startsAt)}–{clockTime(block.endsAt)}
        {block.location ? ` · ${block.location}` : ''}
        {block.overlapping ? ' · clashes' : ''}
      </Text>
    </Pressable>
  );
}
