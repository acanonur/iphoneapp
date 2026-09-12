import { Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  ArchiveIcon,
  CalendarIcon,
  FileTextIcon,
  ListChecksIcon,
  PlaneIcon,
  SunIcon,
  type IconProps,
} from '../../src/ui/icons.js';
import { colors, fonts, rules } from '../../src/ui/theme.js';

const TABS: { name: string; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { name: 'today', label: 'Today', Icon: SunIcon },
  { name: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { name: 'lists', label: 'Lists', Icon: ListChecksIcon },
  { name: 'notes', label: 'Notes', Icon: FileTextIcon },
  { name: 'archive', label: 'Archive', Icon: ArchiveIcon },
  { name: 'trips', label: 'Trips', Icon: PlaneIcon },
];

/**
 * The tab bar, drawn by hand rather than configured.
 *
 * Modernist wants labels flush left under their icon, 1px rules between the
 * columns and a 2px accent bar sitting on the top edge of the active one —
 * none of which the default tab bar can express, and all of which is what
 * makes the bar read as part of the same ruled grid as the screens above it.
 */
function ModernistTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg,
        borderTopWidth: rules.section,
        borderTopColor: colors.divider,
        paddingBottom: insets.bottom,
      }}
    >
      {TABS.map((tab, index) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const focused = state.index === routeIndex;
        const tint = focused ? colors.accent : colors.textMuted;

        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const route = state.routes[routeIndex];
              if (!route) return;
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={{
              flex: 1,
              paddingTop: 8,
              paddingLeft: 8,
              paddingBottom: 8,
              gap: 4,
              borderLeftWidth: index === 0 ? 0 : 1,
              borderLeftColor: colors.divider,
            }}
          >
            {/* The 2px accent bar overlaps the bar's own top rule. */}
            {focused ? (
              <View
                style={{
                  position: 'absolute',
                  top: -rules.section,
                  left: index === 0 ? 0 : -1,
                  right: 0,
                  height: rules.section,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}
            <tab.Icon size={20} color={tint} />
            <Text style={{ fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: tint }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ModernistTabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
