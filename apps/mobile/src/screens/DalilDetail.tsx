import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Dalil, NodeSummary } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { dalilLabel } from '../share/shareText';
import { useUser } from '../state/userStore';
import { Banner, Card, Screen, Section, T } from '../ui/components';
import { DalilCard } from '../ui/DalilCard';
import { space } from '../ui/theme';

export default function DalilDetail() {
  const t = useT();
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const repo = useRepo();
  const translation = useUser((s) => s.dalilTranslation);
  const [dalil, setDalil] = useState<Dalil | null>(null);
  const [citing, setCiting] = useState<NodeSummary[]>([]);

  useEffect(() => {
    void repo.dalil(ref).then(setDalil);
    void repo.citing(ref).then(setCiting);
  }, [ref, repo]);

  if (!dalil) return <Screen>{null}</Screen>;
  return (
    <Screen>
      <Stack.Screen options={{ title: dalilLabel(dalil) }} />
      {dalil.kind === 'hadith' && dalil.status !== 'verified' && (
        <Banner text={t('node.unverified')} tone="danger" />
      )}
      <DalilCard dalil={dalil} translation={translation} />
      {dalil.kind === 'hadith' && (
        <Card>
          <T variant="heading">{t('dalil.asQuotedIn')}</T>
          {dalil.source.scholar ? <T>{t('node.scholar', { v: dalil.source.scholar })}</T> : null}
          {dalil.source.work ? <T>{t('node.work', { v: dalil.source.work })}</T> : null}
          {dalil.source.url ? <T variant="muted">{dalil.source.url}</T> : null}
        </Card>
      )}
      {citing.length > 0 && (
        <Section title={t('dalil.citedBy')}>
          <View style={{ gap: space.m }}>
            {citing.map((n) => (
              <Card
                key={n.id}
                onPress={() => router.push(`/node/${n.id}`)}
                accessibilityLabel={n.claimEn}
              >
                <T>{n.claimEn}</T>
              </Card>
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}
