import { Pressable, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { StringKey } from '../../src/i18n';
import { useT } from '../../src/store/useStore';
import { BasketIcon, BookIcon, GearIcon, SparkIcon, type IconProps } from '../../src/ui/icons';
import { colors, elevation, fonts, radius } from '../../src/ui/theme';

const TABS: { name: string; label: StringKey; Icon: (p: IconProps) => React.ReactElement }[] = [
  { name: 'index', label: 'tab.recipes', Icon: BookIcon },
  { name: 'make', label: 'tab.make', Icon: SparkIcon },
  { name: 'shopping', label: 'tab.shopping', Icon: BasketIcon },
  { name: 'settings', label: 'tab.settings', Icon: GearIcon },
];

/** A rounded bar floating above the bottom edge; the active tab is a green-tinted pill. */
function TutamTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <View style={{ backgroundColor: colors.bg, paddingHorizontal: 14, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10) }}>
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
          const tint = focused ? colors.accentText : colors.textMuted;
          return (
            <Pressable
              key={tab.name}
              accessibilityRole="tab"
              accessibilityLabel={t(tab.label)}
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const route = state.routes[routeIndex];
                if (!route) return;
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingVertical: 7,
                borderRadius: radius.pill,
                backgroundColor: focused ? colors.accentSoft : 'transparent',
              }}
            >
              <tab.Icon size={22} color={tint} strokeWidth={focused ? 2.1 : 1.8} />
              <Text
                numberOfLines={1}
                style={{ fontFamily: focused ? fonts.bold : fonts.semi, fontSize: 11, lineHeight: 14, color: tint }}
              >
                {t(tab.label)}
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
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TutamTabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}
