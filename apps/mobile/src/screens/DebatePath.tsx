import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import type { NodeSummary } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Button, Card, Screen, T } from '../ui/components';

export default function DebatePath() {
  const t = useT();
  const repo = useRepo();
  const path = useUser((s) => s.debatePath);
  const jumpTo = useUser((s) => s.jumpTo);
  const newDebate = useUser((s) => s.newDebate);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  useEffect(() => {
    void repo.summaries(path).then(setNodes);
  }, [repo, path]);
  return (
    <Screen>
      <Stack.Screen options={{ title: t('path.title') }} />
      {nodes.length === 0 && <T variant="muted">{t('path.empty')}</T>}
      {nodes.map((n, i) => (
        <Card
          key={`${n.id}-${i}`}
          onPress={() => {
            jumpTo(n.id);
            router.push(`/node/${n.id}`);
          }}
          accessibilityLabel={t('path.step', { n: i + 1, claim: n.claimEn })}
        >
          <T variant="muted">{i + 1}</T>
          <T>{n.claimEn}</T>
        </Card>
      ))}
      {nodes.length > 0 && <Button kind="secondary" label={t('path.new')} onPress={newDebate} />}
    </Screen>
  );
}
