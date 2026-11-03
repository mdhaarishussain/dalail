import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useT } from '../i18n/useT';
import { useServices } from '../services/ServicesContext';
import { Banner, Button, Card, Screen, T } from '../ui/components';
import { space } from '../ui/theme';
import { useUser } from '../state/userStore';

export default function Onboarding() {
  const t = useT();
  const { detectedTier } = useServices();
  const set = useUser((s) => s.set);
  const language = useUser((s) => s.language);
  const [step, setStep] = useState(0);

  if (step === 0) {
    return (
      <Screen>
        <T variant="title" accessibilityRole="header">
          {t('onboarding.languageTitle')}
        </T>
        <View style={{ gap: space.m }}>
          <Button
            label="English"
            kind={language === 'en' ? 'primary' : 'secondary'}
            onPress={() => set({ language: 'en' })}
          />
          <Button
            label="Roman Urdu"
            kind={language === 'roman-ur' ? 'primary' : 'secondary'}
            onPress={() => set({ language: 'roman-ur' })}
          />
        </View>
        <Button label={t('common.continue')} onPress={() => setStep(1)} testID="onboarding-next" />
      </Screen>
    );
  }
  if (step === 1) {
    return (
      <Screen>
        <T variant="title" accessibilityRole="header">
          {t('onboarding.aboutTitle')}
        </T>
        <Card>
          <T>{t('onboarding.about1')}</T>
          <T>{t('onboarding.about2')}</T>
          <T>{t('onboarding.about3')}</T>
        </Card>
        <Button label={t('common.continue')} onPress={() => setStep(2)} testID="onboarding-next" />
      </Screen>
    );
  }
  return (
    <Screen>
      <T variant="title" accessibilityRole="header">
        {t('onboarding.deviceTitle')}
      </T>
      <Card>
        <T variant="heading">{detectedTier === 'full' ? t('mode.full') : t('mode.lite')}</T>
        <T>{detectedTier === 'full' ? t('onboarding.fullExplain') : t('onboarding.liteExplain')}</T>
      </Card>
      <Banner text={t('onboarding.modelLater')} />
      <Button
        label={t('onboarding.start')}
        testID="onboarding-done"
        onPress={() => {
          set({ onboarded: true });
          router.replace('/');
        }}
      />
    </Screen>
  );
}
