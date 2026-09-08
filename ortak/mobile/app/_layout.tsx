import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import { useStore } from '../src/store/useStore.js';
import { connectSocket, disconnectSocket } from '../src/store/socket.js';
import { colors, fonts } from '../src/ui/theme.js';

export default function RootLayout() {
  // Archivo carries the whole Modernist system — 800 for anything structural,
  // 400 for body. Holding the splash until it loads avoids a flash of the
  // system font in a design where the typeface *is* the identity.
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  });

  const status = useStore((s) => s.status);
  const bootstrap = useStore((s) => s.bootstrap);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Hold the realtime connection for as long as there is a session.
  useEffect(() => {
    if (status === 'ready') {
      connectSocket();
      return () => disconnectSocket();
    }
    return undefined;
  }, [status]);

  // Send people to onboarding until they have a space, and out of it once they do.
  useEffect(() => {
    if (status === 'loading') return;
    const onOnboarding = segments[0] === 'onboarding';

    if (status === 'unconfigured' && !onOnboarding) {
      router.replace('/onboarding');
    } else if (status === 'ready' && onOnboarding) {
      router.replace('/(tabs)/today');
    }
  }, [status, segments, router]);

  if (status === 'loading' || !fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.heading, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ title: 'Search' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="import" options={{ title: 'Import chat' }} />
        <Stack.Screen name="capture" options={{ title: 'Save', presentation: 'modal' }} />
        <Stack.Screen name="note/[id]" options={{ title: 'Note' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen name="chat/[name]" options={{ title: 'Chat' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
