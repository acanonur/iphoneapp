import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/ui/theme.js';

/**
 * Emoji tab icons keep the app dependency-free — no icon font to bundle and no
 * vector library, and they read fine at tab-bar size on both platforms.
 */
function Icon({ glyph, color }: { glyph: string; color: string }) {
  return <Text style={{ fontSize: 20, color, opacity: color === colors.accent ? 1 : 0.75 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <Icon glyph="☀️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <Icon glyph="📅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: 'Lists',
          tabBarIcon: ({ color }) => <Icon glyph="✅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarIcon: ({ color }) => <Icon glyph="📝" color={color} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: 'Archive',
          tabBarIcon: ({ color }) => <Icon glyph="🗂️" color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color }) => <Icon glyph="✈️" color={color} />,
        }}
      />
    </Tabs>
  );
}
