import { Tabs } from 'expo-router';
import { useT } from '../../i18n/useT';
import { useColors } from '../../ui/theme';

export default function TabsLayout() {
  const t = useT();
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarIcon: () => null,
        tabBarLabelStyle: { fontSize: 15, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.ask'), tabBarAccessibilityLabel: t('tabs.ask') }}
      />
      <Tabs.Screen
        name="browse"
        options={{ title: t('tabs.browse'), tabBarAccessibilityLabel: t('tabs.browse') }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: t('tabs.saved'), tabBarAccessibilityLabel: t('tabs.saved') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: t('tabs.settings'), tabBarAccessibilityLabel: t('tabs.settings') }}
      />
    </Tabs>
  );
}
