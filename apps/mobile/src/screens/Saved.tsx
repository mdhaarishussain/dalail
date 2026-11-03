import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NodeSummary } from '../data/types';
import { useT } from '../i18n/useT';
import { useServices } from '../services/ServicesContext';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Button, Card, Screen, Section, T } from '../ui/components';
import { space } from '../ui/theme';

/** The export format the owner uses to turn real unanswered questions into nodes or aliases. */
export function savedQuestionsExport(saved: { q: string; at: string }[], corpusVersion: string) {
  return {
    kind: 'dalail-saved-questions',
    version: 1,
    corpus_version: corpusVersion,
    exported_at: new Date().toISOString(),
    questions: saved.map((s) => ({ q: s.q, saved_at: s.at })),
  };
}

export default function Saved() {
  const t = useT();
  const repo = useRepo();
  const { meta } = useServices();
  const bookmarks = useUser((s) => s.bookmarks);
  const saved = useUser((s) => s.savedQuestions);
  const remove = useUser((s) => s.removeSavedQuestion);
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  useEffect(() => {
    void repo.summaries(bookmarks).then(setNodes);
  }, [repo, bookmarks]);

  const exportQuestions = async () => {
    const file = new File(Paths.cache, 'dalail-saved-questions.json');
    file.create({ overwrite: true });
    await file.write(JSON.stringify(savedQuestionsExport(saved, meta.corpusVersion), null, 2));
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: t('saved.export'),
    });
  };

  return (
    <Screen>
      <Section title={t('saved.bookmarks')}>
        {nodes.length === 0 && <T variant="muted">{t('saved.noBookmarks')}</T>}
        <View style={{ gap: space.m }}>
          {nodes.map((n) => (
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
      <Section title={t('saved.questions')}>
        {saved.length === 0 && <T variant="muted">{t('saved.noQuestions')}</T>}
        <View style={{ gap: space.m }}>
          {saved.map((s) => (
            <Card key={s.at}>
              <T>{s.q}</T>
              <Button kind="secondary" label={t('saved.remove')} onPress={() => remove(s.at)} />
            </Card>
          ))}
        </View>
        {saved.length > 0 && (
          <Button label={t('saved.export')} onPress={() => void exportQuestions()} />
        )}
      </Section>
    </Screen>
  );
}
