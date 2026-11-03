import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import type { NodeSummary } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Chip } from './components';
import { space } from './theme';

const short = (s: string, n = 32) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Breadcrumb of claims visited in this debate; tap one to jump back. */
export function PathBar({ currentId }: { currentId: string }) {
  const t = useT();
  const repo = useRepo();
  const path = useUser((s) => s.debatePath);
  const jumpTo = useUser((s) => s.jumpTo);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  useEffect(() => {
    void repo.summaries(path).then(setNodes);
  }, [repo, path]);
  if (nodes.length < 2) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.s }}
      accessibilityLabel={t('path.label')}
    >
      {nodes.map((n, i) => (
        <Chip
          key={`${n.id}-${i}`}
          label={`${i + 1}. ${short(n.claimEn)}`}
          selected={n.id === currentId}
          accessibilityLabel={t('path.step', { n: i + 1, claim: n.claimEn })}
          onPress={() => {
            jumpTo(n.id);
            if (n.id !== currentId) router.replace(`/node/${n.id}`);
          }}
        />
      ))}
      <Chip label={t('path.all')} onPress={() => router.push('/path')} />
    </ScrollView>
  );
}
