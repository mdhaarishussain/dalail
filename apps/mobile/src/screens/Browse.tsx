import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Topic } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Card, Screen, T } from '../ui/components';
import { space } from '../ui/theme';

export default function Browse() {
  const t = useT();
  const repo = useRepo();
  const language = useUser((s) => s.language);
  const [topics, setTopics] = useState<Topic[]>([]);
  useEffect(() => {
    void repo.topics().then(setTopics);
  }, [repo]);
  return (
    <Screen>
      <T variant="title" accessibilityRole="header">
        {t('browse.title')}
      </T>
      <View style={{ gap: space.m }}>
        {topics.map((tp) => {
          const name = language === 'roman-ur' ? tp.nameRomanUrdu : tp.nameEn;
          return (
            <Card
              key={tp.id}
              onPress={() => router.push(`/browse/${tp.id}`)}
              accessibilityLabel={name}
              testID={`topic-${tp.id}`}
            >
              <T variant="heading">{name}</T>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
