import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { setBaseUrl } from '@workspace/api-client-react';
import {
  configureNotificationHandler,
  requestNotificationPermission,
  setupAndroidChannel,
} from '@/lib/notifications';

// ─── Module-level setup ───────────────────────────────────────────────────────

// Point the shared API client at the deployed/dev domain.
// Prefer an explicit API URL; fall back to Replit-style domain; leave unset for same-origin (web).
const apiBase =
  process.env.EXPO_PUBLIC_API_URL ||
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : null);
if (apiBase) {
  setBaseUrl(apiBase.replace(/\/+$/, ''));
}

// Configure how notifications look when the app is foregrounded.
configureNotificationHandler();

// Prevent the splash screen from auto-hiding before assets are loaded.
SplashScreen.preventAutoHideAsync();

// ─── React Query client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// ─── Notification deep-link handler ──────────────────────────────────────────

/**
 * Listens for notification tap events and navigates to the Reminders tab.
 * Must be rendered inside the Expo Router context (inside <Stack>).
 */
function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Handle a notification tap that launches (or re-opens) the app.
    const handleLastResponse = async () => {
      const response = await Notifications.getLastNotificationResponseAsync();
      if (response?.notification.request.content.data?.screen === 'reminders') {
        router.navigate('/(tabs)/reminders');
      }
    };
    handleLastResponse();

    // Handle a notification tap while the app is already running.
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.notification.request.content.data?.screen === 'reminders') {
        router.navigate('/(tabs)/reminders');
      }
    });

    return () => sub.remove();
  }, [router]);

  return null;
}

// ─── Root layout ─────────────────────────────────────────────────────────────

function RootLayoutNav() {
  return (
    <>
      <NotificationHandler />
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Request notification permission + Android channel before any reminder can schedule.
  useEffect(() => {
    (async () => {
      await setupAndroidChannel();
      await requestNotificationPermission();
    })();
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <RootLayoutNav />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
