import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { AppShell } from '../AppShell';
import { initDeviceServices } from '../services/device';
import type { Services } from '../services/ServicesContext';
import { hydrateUserStore } from '../state/userStore';

export default function RootLayout() {
  const [services, setServices] = useState<Services | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initDeviceServices()
      .then(async (s) => {
        await hydrateUserStore();
        setServices(s);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text accessibilityRole="alert">Dalail could not open its data: {error}</Text>
      </View>
    );
  }
  if (!services) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Loading" />
      </View>
    );
  }
  return <AppShell services={services} />;
}
