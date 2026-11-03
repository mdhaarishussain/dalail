import type { RetrievalResult } from '@dalail/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useT } from '../i18n/useT';
import { runSearch } from '../search/runSearch';
import { useServices } from '../services/ServicesContext';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Banner, Button, Card, Screen, T } from '../ui/components';
import { space } from '../ui/theme';

export default function Results() {
  const t = useT();
  const { q = '' } = useLocalSearchParams<{ q: string }>();
  const repo = useRepo();
  const { embedQuery } = useServices();
  const addRecent = useUser((s) => s.addRecent);
  const saveQuestion = useUser((s) => s.saveQuestion);
  const saved = useUser((s) => s.savedQuestions.some((x) => x.q === q.trim()));
  const [result, setResult] = useState<RetrievalResult | null>(null);

  useEffect(() => {
    let live = true;
    addRecent(q);
    void runSearch(q, { repo, embedQuery }).then((r) => {
      if (!live) return;
      if (r.status === 'match' && r.candidates[0]) {
        router.replace(`/node/${r.candidates[0].nodeId}`);
      } else {
        setResult(r);
      }
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per query
  }, [q]);

  if (!result) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('results.searching') }} />
        <ActivityIndicator accessibilityLabel={t('results.searching')} />
      </Screen>
    );
  }

  if (result.status === 'ambiguous') {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('results.didYouMean') }} />
        <T variant="title" accessibilityRole="header">
          {t('results.didYouMean')}
        </T>
        <T variant="muted">{t('results.ambiguousHelp')}</T>
        <View style={{ gap: space.m }}>
          {result.candidates.map((c) => (
            <Card
              key={c.nodeId}
              onPress={() => router.replace(`/node/${c.nodeId}`)}
              accessibilityLabel={c.claimEn}
              testID={`candidate-${c.nodeId}`}
            >
              {c.status !== 'verified' && <Banner text={t('node.unverified')} />}
              <T>{c.claimEn}</T>
            </Card>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('results.noMatchTitle') }} />
      <T variant="title" accessibilityRole="header">
        {t('results.noMatchTitle')}
      </T>
      <T>{t('results.noMatchBody')}</T>
      <Card>
        <T variant="muted">{t('results.yourQuestion')}</T>
        <T>{q}</T>
      </Card>
      <Button
        testID="save-question"
        label={saved ? t('results.saved') : t('results.saveQuestion')}
        disabled={saved}
        onPress={() => saveQuestion(q)}
      />
      <Button
        kind="secondary"
        label={t('results.browse')}
        onPress={() => router.replace('/browse')}
      />
    </Screen>
  );
}
