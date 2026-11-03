import { router } from 'expo-router';
import { useT } from '../i18n/useT';
import { useServices } from '../services/ServicesContext';
import { effectiveTier } from '../services/tier';
import { useUser, type DalilTranslation, type ModeOverride } from '../state/userStore';
import { Banner, Button, Card, Chip, Row, Screen, Section, T } from '../ui/components';

export default function Settings() {
  const t = useT();
  const { meta, detectedTier } = useServices();
  const s = useUser();
  const tier = effectiveTier(detectedTier, s.mode);
  const modes: ModeOverride[] = ['auto', 'full', 'lite'];
  const translations: DalilTranslation[] = ['ur', 'en', 'both'];
  return (
    <Screen>
      <Section title={t('settings.language')}>
        <Row>
          <Chip
            label="English"
            selected={s.language === 'en'}
            onPress={() => s.set({ language: 'en' })}
          />
          <Chip
            label="Roman Urdu"
            selected={s.language === 'roman-ur'}
            onPress={() => s.set({ language: 'roman-ur' })}
          />
        </Row>
      </Section>
      <Section title={t('settings.mode')}>
        <Row>
          {modes.map((m) => (
            <Chip
              key={m}
              label={t(`settings.mode.${m}`)}
              selected={s.mode === m}
              onPress={() => s.set({ mode: m })}
            />
          ))}
        </Row>
        <T variant="muted">
          {t('settings.modeNow', {
            mode: tier === 'full' ? t('mode.full') : t('mode.lite'),
            detected: detectedTier === 'full' ? t('mode.full') : t('mode.lite'),
          })}
        </T>
        {s.mode !== 'auto' && s.mode !== detectedTier && (
          <Banner text={t('settings.modeWarning')} />
        )}
        <T variant="muted">{t('onboarding.modelLater')}</T>
      </Section>
      <Section title={t('settings.dalilTranslation')}>
        <Row>
          {translations.map((x) => (
            <Chip
              key={x}
              label={t(`settings.translation.${x}`)}
              selected={s.dalilTranslation === x}
              onPress={() => s.set({ dalilTranslation: x })}
            />
          ))}
        </Row>
      </Section>
      <Card>
        <T variant="heading">{t('settings.corpus')}</T>
        <T>{t('settings.corpusVersion', { v: meta.corpusVersion })}</T>
        <T variant="muted">
          {t('settings.corpusBuild', { mode: meta.buildMode, at: meta.builtAt })}
        </T>
      </Card>
      <Button
        kind="secondary"
        label={t('settings.about')}
        onPress={() => router.push('/settings/about')}
      />
      <Button
        kind="secondary"
        label={t('settings.licences')}
        onPress={() => router.push('/settings/licences')}
      />
      {meta.buildMode === 'dev' && (
        <Section title={t('settings.dev')}>
          <Row>
            <Chip
              label={t('settings.showResearch')}
              selected={s.showResearch}
              onPress={() => s.set({ showResearch: !s.showResearch })}
            />
            <Chip
              label={t('settings.showUnverified')}
              selected={s.showUnverified}
              onPress={() => s.set({ showUnverified: !s.showUnverified })}
            />
          </Row>
          <Button
            kind="secondary"
            label={t('settings.diagnostics')}
            onPress={() => router.push('/settings/diagnostics')}
          />
        </Section>
      )}
    </Screen>
  );
}
