import { Stack } from 'expo-router';
import { useState } from 'react';
import { useT } from '../i18n/useT';
import { Card, Screen, T } from '../ui/components';
import licences from './licences.json';

export default function Licences() {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.licences') }} />
      {licences.map((l) => (
        <Card
          key={l.name}
          onPress={() => setOpen(open === l.name ? null : l.name)}
          accessibilityLabel={l.name}
        >
          <T variant="heading">{l.name}</T>
          <T variant="muted">{l.licence}</T>
          {open === l.name && <T variant="small">{l.text}</T>}
        </Card>
      ))}
    </Screen>
  );
}
