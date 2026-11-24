import { Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  CalendarIcon,
  FileTextIcon,
  ListChecksIcon,
  SunIcon,
  WalletIcon,
  type IconProps,
} from '../../src/ui/icons.js';
import { colors, elevation, fonts, radius } from '../../src/ui/theme.js';

const TABS: { name: string; label: string; Icon: (p: IconProps) => React.ReactElement }[] = [
  { name: 'today', label: 'Today', Icon: SunIcon },
  { name: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { name: 'lists', label: 'Lists', Icon: ListChecksIcon },
  { name: 'notes', label: 'Notes', Icon: FileTextIcon },
  { name: 'money', label: 'Money', Icon: WalletIcon },
];

/**
 * The tab bar: a rounded bar floating a little above the bottom edge, with the
 * active tab picked out as a coral-tinted pill.
 *
 * Five destinations, not six — the chat archive is reached from Notes and from
 * Search, because "too many options" is the standing complaint about apps in
 * this category and a tab is the most expensive place to put a rarely-used one.
 */
function IkimizTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 12, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
      <View
        style={[
          {
            flexDirection: 'row',
            backgroundColor: colors.surface,
            borderRadius: radius.pill,
            padding: 5,
            borderWidth: 1,
            borderColor: colors.dividerSoft,
          },
          elevation.card,
        ]}
      >
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const focused = state.index === routeIndex;
          const tint = focused ? colors.accent700 : colors.textMuted;

          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
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
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingVertical: 7,
                borderRadius: radius.pill,
                backgroundColor: focused ? colors.accent100 : 'transparent',
              }}
            >
              <tab.Icon size={21} color={tint} strokeWidth={focused ? 2.2 : 1.8} />
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: focused ? fonts.heading : fonts.headingSemi,
                  fontSize: 10.5,
                  lineHeight: 13,
                  color: tint,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <IkimizTabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}
