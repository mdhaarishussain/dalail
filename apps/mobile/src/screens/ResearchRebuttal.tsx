import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import type { NodeDetail, ResearchInfo } from '../data/types';
import type { StringKey } from '../i18n';
import { useT } from '../i18n/useT';
import { Banner, Button, Card, Section, T } from '../ui/components';
import { PathBar } from '../ui/PathBar';
import { space } from '../ui/theme';

const MOVE_TYPES = new Set([
  'practice-consensus', 'restrict-evidence', 'consistency', 'principle', 'burden', 'support-chain',
  'turnabout', 'definition', 'charge', 'attack-chain', 'reconciliation',
]); // prettier-ignore

/** Opens the video at that moment. User-initiated link, not an app network call (ADR 0008). */
function WatchLink({ at, url }: { at: string; url: string }) {
  const t = useT();
  if (!url) return null;
  return (
    <Button
      kind="secondary"
      label={t('research.watchAt', { at })}
      onPress={() => void Linking.openURL(url)}
    />
  );
}

/**
 * Dev builds only: an AI-extracted claim from the research set. No quick reply, no share, no dalil
 * cards; evidence "as said" is plain text. Everything sits under the amber banner.
 */
export function ResearchRebuttal({ node, research }: { node: NodeDetail; research: ResearchInfo }) {
  const t = useT();
  const moveKey = `research.moveType.${research.moveType}` as StringKey;
  const first = research.occurrences[0];
  return (
    <>
      <PathBar currentId={node.id} />
      <Banner text={t('research.banner')} testID="research-banner" />

      <Section title={t('node.theirClaim')}>
        <Card>
          {MOVE_TYPES.has(research.moveType) && (
            <T variant="small" style={{ fontWeight: '700' }} testID="move-type">
              {t(moveKey)}
            </T>
          )}
          <T testID="claim-text">{node.claimEn}</T>
          {research.summaryEn ? <T variant="muted">{research.summaryEn}</T> : null}
          {first ? <WatchLink at={first.at} url={first.deepLink} /> : null}
          {research.occurrences.length > 1 && (
            <T variant="muted">{t('research.seenIn', { n: research.occurrences.length })}</T>
          )}
        </Card>
      </Section>

      <Section title={t('research.candidateResponses')}>
        {research.candidateResponses.length === 0 && (
          <T variant="muted">{t('research.noResponse')}</T>
        )}
        <View style={{ gap: space.m }}>
          {research.candidateResponses.map((r, i) => (
            <Card key={`${r.deepLink}-${i}`} testID={`candidate-response-${i}`}>
              <T variant="muted">{t('research.responseBy', { who: r.speaker })}</T>
              <T>{r.quote}</T>
              {r.summaryEn ? <T variant="muted">{r.summaryEn}</T> : null}
              {r.evidenceAsSaid.length > 0 && (
                <T variant="small">
                  {t('research.evidenceAsSaid', { list: r.evidenceAsSaid.join(' · ') })}
                </T>
              )}
              <WatchLink at={r.at} url={r.deepLink} />
            </Card>
          ))}
        </View>
      </Section>

      {research.counterQuestions.length > 0 && (
        <Section title={t('research.askBack')}>
          <View style={{ gap: space.m }}>
            {research.counterQuestions.map((q) => (
              <Card key={q.id} testID={`counter-question-${q.id}`}>
                <T>{q.quote}</T>
                {q.summaryEn ? <T variant="muted">{q.summaryEn}</T> : null}
                <WatchLink at={q.at} url={q.deepLink} />
              </Card>
            ))}
          </View>
        </Section>
      )}

      {node.followUps.length > 0 && (
        <Section title={t('node.ifTheySay')}>
          <View style={{ gap: space.m }}>
            {node.followUps.map((f) => (
              <Card
                key={f.id}
                onPress={() => router.push(`/node/${f.id}`)}
                accessibilityLabel={f.claimEn}
                testID={`followup-${f.id}`}
              >
                {f.origin === 'gemini-research' && <T variant="small">{t('research.badge')}</T>}
                <T>{f.claimEn}</T>
              </Card>
            ))}
          </View>
        </Section>
      )}

      <Card>
        <T variant="heading">{t('node.sourceTitle')}</T>
        {research.occurrences.map((o) => (
          <T key={`${o.sourceId}-${o.at}`} variant="small">
            {t('research.sourceLine', {
              title: o.title || o.sourceId,
              at: o.at,
              coverage: o.coverage.toFixed(2),
            })}
          </T>
        ))}
        <T variant="muted">{t('node.notVerifiedYet')}</T>
      </Card>
    </>
  );
}
