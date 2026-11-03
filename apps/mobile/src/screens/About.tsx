import { Stack } from 'expo-router';
import { useT } from '../i18n/useT';
import { Card, Screen, T } from '../ui/components';

/** Content about the scholars and the verification process is supplied by the project owner. */
export default function About() {
  const t = useT();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.about') }} />
      <Card>
        <T>{t('about.how')}</T>
      </Card>
      <T variant="muted">{t('about.pending')}</T>
    </Screen>
  );
}
