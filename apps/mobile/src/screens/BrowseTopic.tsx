import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NodeSummary, Opponent, Topic } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Banner, Card, Chip, Row, Screen, T } from '../ui/components';
import { space } from '../ui/theme';

export default function BrowseTopic() {
  const t = useT();
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const repo = useRepo();
  const language = useUser((s) => s.language);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [info, setInfo] = useState<Topic | null>(null);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);

  useEffect(() => {
    void repo.opponents().then(setOpponents);
    void repo.topics().then((ts) => setInfo(ts.find((x) => x.id === topic) ?? null));
  }, [repo, topic]);
  useEffect(() => {
    void repo.nodesByTopic(topic, opponent).then(setNodes);
  }, [repo, topic, opponent]);

  const name = info ? (language === 'roman-ur' ? info.nameRomanUrdu : info.nameEn) : topic;
  const label = (o: Opponent) => (language === 'roman-ur' ? o.nameRomanUrdu : o.nameEn);
  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />
      <Row>
        <Chip
          label={t('browse.allOpponents')}
          selected={opponent === null}
          onPress={() => setOpponent(null)}
        />
        {opponents.map((o) => (
          <Chip
            key={o.id}
            label={label(o)}
            selected={opponent === o.id}
            onPress={() => setOpponent(o.id)}
          />
        ))}
      </Row>
      {nodes.length === 0 && <T variant="muted">{t('browse.empty')}</T>}
      <View style={{ gap: space.m }}>
        {nodes.map((n) => (
          <Card
            key={n.id}
            onPress={() => router.push(`/node/${n.id}`)}
            accessibilityLabel={n.claimEn}
            testID={`claim-${n.id}`}
          >
            {n.origin === 'gemini-research' ? (
              <T variant="small">{t('research.badge')}</T>
            ) : (
              n.status !== 'verified' && <Banner text={t('node.unverified')} />
            )}
            <T>{n.claimEn}</T>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
