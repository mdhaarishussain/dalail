import * as Clipboard from 'expo-clipboard';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import type { Dalil, NodeDetail } from '../data/types';
import { useT } from '../i18n/useT';
import { useRepo } from '../services/useRepo';
import { canShare, dalilLabel, formatShareText } from '../share/shareText';
import { useUser } from '../state/userStore';
import { Banner, Button, Card, Chip, Row, Screen, Section, T } from '../ui/components';
import { DalilCard } from '../ui/DalilCard';
import { Markdown } from '../ui/Markdown';
import { stripResponseHeading } from '../ui/markdown';
import { PathBar } from '../ui/PathBar';
import { ResearchRebuttal } from './ResearchRebuttal';
import { space } from '../ui/theme';

const openDalil = (ref: string) => router.push({ pathname: '/dalil/[ref]', params: { ref } });

export default function Rebuttal() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repo = useRepo();
  const visit = useUser((s) => s.visit);
  const bookmarked = useUser((s) => s.bookmarks.includes(id));
  const toggleBookmark = useUser((s) => s.toggleBookmark);
  const translation = useUser((s) => s.dalilTranslation);
  const [node, setNode] = useState<NodeDetail | null | undefined>(undefined);
  const [dalail, setDalail] = useState<Dalil[]>([]);
  const [evidence, setEvidence] = useState<Dalil[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const n = await repo.node(id);
      if (!live) return;
      setNode(n);
      if (!n) return;
      visit(n.id);
      const [d, e] = await Promise.all([
        Promise.all(n.dalail.map((r) => repo.dalil(r))),
        Promise.all(n.theirEvidence.map((r) => repo.dalil(r))),
      ]);
      if (live) {
        setDalail(d);
        setEvidence(e);
      }
    })();
    return () => {
      live = false;
    };
  }, [id, repo, visit]);

  if (node === undefined) return <Screen>{null}</Screen>;
  if (node === null) {
    return (
      <Screen>
        <T>{t('node.notFound')}</T>
      </Screen>
    );
  }

  if (node.research) {
    return (
      <Screen>
        <Stack.Screen options={{ title: t('node.title') }} />
        <ResearchRebuttal node={node} research={node.research} />
      </Screen>
    );
  }

  const shareText = formatShareText(node, dalail);
  const unverified = node.status !== 'verified';
  const cs = node.claimSource;
  const rs = node.responseSource;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('node.title') }} />
      <PathBar currentId={node.id} />
      {unverified && (
        <Banner
          text={t('node.unverifiedBanner', { status: node.status })}
          tone="danger"
          testID="unverified-banner"
        />
      )}
      {node.isFixture && <Banner text={t('node.fixtureBanner')} testID="fixture-banner" />}

      <Section title={t('node.theirClaim')}>
        <Card>
          <T testID="claim-text">{node.claimEn}</T>
          {evidence.length > 0 && (
            <Row>
              <T variant="muted">{t('node.theirEvidence')}</T>
              {evidence.map((d) => (
                <Chip key={d.ref} label={dalilLabel(d)} onPress={() => openDalil(d.ref)} />
              ))}
            </Row>
          )}
          {(cs.work || cs.author) && (
            <T variant="muted">
              {t('node.claimSource', {
                source: [cs.author, cs.work, cs.page].filter(Boolean).join(', '),
              })}
            </T>
          )}
        </Card>
      </Section>

      <Section title={t('node.quickReply')}>
        <Card>
          {node.shortAnswer ? (
            <>
              <T variant="heading" style={{ lineHeight: 28 }} testID="short-answer">
                {node.shortAnswer}
              </T>
              {node.shortAnswerOrigin === 'scholar_review' && (
                <T variant="muted">{t('node.shortAnswerByScholar')}</T>
              )}
              <Button
                kind="secondary"
                label={copied ? t('node.copied') : t('node.copy')}
                onPress={() => {
                  void Clipboard.setStringAsync(node.shortAnswer).then(() => setCopied(true));
                }}
              />
            </>
          ) : (
            <T variant="muted">{t('node.noShortAnswer')}</T>
          )}
        </Card>
      </Section>

      <Section title={t('node.fullResponse')}>
        {expanded ? (
          <Card>
            <Markdown md={stripResponseHeading(node.bodyMd)} lang={node.lang} onRef={openDalil} />
            <Button
              kind="secondary"
              label={t('node.collapse')}
              onPress={() => setExpanded(false)}
            />
          </Card>
        ) : (
          <Button
            kind="secondary"
            label={t('node.expand')}
            onPress={() => setExpanded(true)}
            testID="expand-response"
          />
        )}
      </Section>

      {dalail.length > 0 && (
        <Section title={t('node.dalail')}>
          <View style={{ gap: space.m }}>
            {dalail.map((d) => (
              <DalilCard
                key={d.ref}
                dalil={d}
                translation={translation}
                onPress={() => openDalil(d.ref)}
              />
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
                {f.status !== 'verified' && <Banner text={t('node.unverified')} />}
                <T>{f.claimEn}</T>
              </Card>
            ))}
          </View>
        </Section>
      )}

      <Card>
        <T variant="heading">{t('node.sourceTitle')}</T>
        {rs.scholar ? <T>{t('node.scholar', { v: rs.scholar })}</T> : null}
        {rs.work ? <T>{t('node.work', { v: rs.work })}</T> : null}
        {rs.page ? <T>{t('node.page', { v: rs.page })}</T> : null}
        {node.verifiedBy ? (
          <T>{t('node.verifiedBy', { who: node.verifiedBy, date: node.verifiedOn ?? '' })}</T>
        ) : (
          <T variant="muted">{t('node.notVerifiedYet')}</T>
        )}
      </Card>

      <Row>
        <Button
          kind="secondary"
          label={bookmarked ? t('node.bookmarked') : t('node.bookmark')}
          onPress={() => toggleBookmark(node.id)}
          testID="bookmark"
        />
        <Button
          label={t('node.share')}
          disabled={!shareText}
          accessibilityHint={canShare(node) ? undefined : t('node.shareBlocked')}
          onPress={() => {
            if (shareText) void Share.share({ message: shareText });
          }}
          testID="share"
        />
      </Row>
      {!canShare(node) && <T variant="muted">{t('node.shareBlocked')}</T>}
    </Screen>
  );
}
