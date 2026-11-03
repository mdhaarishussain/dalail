import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useT } from './i18n/useT';
import { ServicesProvider, type Services } from './services/ServicesContext';
import { useColors } from './ui/theme';

/** Navigation + providers. Device init lives in app/_layout.tsx so tests can inject services. */
export function AppShell({ services }: { services: Services }) {
  const t = useT();
  const c = useColors();
  return (
    <ServicesProvider services={services}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTintColor: c.text,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="results" options={{ title: t('results.searching') }} />
        <Stack.Screen name="node/[id]" options={{ title: t('node.title') }} />
        <Stack.Screen name="path" options={{ title: t('path.title') }} />
      </Stack>
    </ServicesProvider>
  );
}
