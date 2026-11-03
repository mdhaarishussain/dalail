import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import type { Topic } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { useUser } from '../state/userStore';
import { Button, Card, Chip, Row, Screen, Section, T } from '../ui/components';
import { radius, space, type, useColors } from '../ui/theme';

export default function Ask() {
  const t = useT();
  const c = useColors();
  const repo = useRepo();
  const onboarded = useUser((s) => s.onboarded);
  const language = useUser((s) => s.language);
  const recents = useUser((s) => s.recents);
  const path = useUser((s) => s.debatePath);
  const [q, setQ] = useState('');
  const [topics, setTopics] = useState<Topic[]>([]);

  useEffect(() => {
    void repo.topics().then(setTopics);
  }, [repo]);

  if (!onboarded) return <Redirect href="/onboarding" />;

  const submit = (query: string) => {
    const text = query.trim();
    if (text) router.push({ pathname: '/results', params: { q: text } });
  };

  return (
    <Screen>
      <T variant="title" accessibilityRole="header">
        {t('ask.title')}
      </T>
      <TextInput
        testID="ask-input"
        value={q}
        onChangeText={setQ}
        placeholder={t('ask.placeholder')}
        placeholderTextColor={c.muted}
        accessibilityLabel={t('ask.placeholder')}
        multiline
        returnKeyType="search"
        blurOnSubmit
        onSubmitEditing={() => submit(q)}
        style={{
          minHeight: 110,
          fontSize: type.body + 2,
          color: c.text,
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: radius.l,
          padding: space.l,
          textAlignVertical: 'top',
        }}
      />
      <Button
        label={t('ask.submit')}
        onPress={() => submit(q)}
        disabled={!q.trim()}
        testID="ask-submit"
      />

      {path.length > 0 && (
        <Card
          onPress={() => router.push(`/node/${path[path.length - 1]}`)}
          accessibilityLabel={t('ask.continueDebate')}
        >
          <T variant="heading">{t('ask.continueDebate')}</T>
          <T variant="muted">{t('ask.pathLength', { n: path.length })}</T>
        </Card>
      )}

      <Section title={t('ask.browseTopics')}>
        <Row>
          {topics.map((tp) => (
            <Chip
              key={tp.id}
              label={language === 'roman-ur' ? tp.nameRomanUrdu : tp.nameEn}
              onPress={() => router.push(`/browse/${tp.id}`)}
            />
          ))}
        </Row>
      </Section>

      {recents.length > 0 && (
        <Section title={t('ask.recent')}>
          <View style={{ gap: space.s }}>
            {recents.slice(0, 8).map((r) => (
              <Card
                key={r.at}
                onPress={() => submit(r.q)}
                accessibilityLabel={t('ask.searchAgain', { q: r.q })}
              >
                <T>{r.q}</T>
              </Card>
            ))}
          </View>
        </Section>
      )}
    </Screen>
  );
}
