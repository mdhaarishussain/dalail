import { View } from 'react-native';
import type { Dalil } from '../data/types';
import { useT } from '../i18n/useT';
import { dalilLabel } from '../share/shareText';
import type { DalilTranslation } from '../state/userStore';
import { ArabicText, Card, T, UrduText } from './components';
import { space } from './theme';

/** Shows a dalil exactly as stored: Arabic, translation(s), reference, grading (hadith). */
export function DalilCard({
  dalil,
  translation,
  onPress,
}: {
  dalil: Dalil;
  translation: DalilTranslation;
  onPress?: () => void;
}) {
  const t = useT();
  const label = dalilLabel(dalil);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={t('dalil.open', { ref: label })}
      testID={`dalil-${dalil.ref}`}
    >
      {dalil.kind === 'missing' && <T variant="muted">{t('dalil.missing', { ref: dalil.ref })}</T>}
      {dalil.kind === 'quran' &&
        (dalil.missing ? (
          <T variant="muted">{t('dalil.quranMissing')}</T>
        ) : (
          dalil.ayat.map((a) => (
            <View key={a.ayah} style={{ gap: space.s }}>
              <ArabicText>{a.textAr}</ArabicText>
              {translation !== 'en' && a.translationUr ? (
                <UrduText>{a.translationUr}</UrduText>
              ) : null}
              {translation !== 'ur' && a.translationEn ? <T>{a.translationEn}</T> : null}
              {translation !== 'ur' && a.translationEn && a.translationEnSource ? (
                <T variant="muted">
                  {t('dalil.translationSource', { source: a.translationEnSource })}
                </T>
              ) : null}
            </View>
          ))
        ))}
      {(dalil.kind === 'hadith' || dalil.kind === 'fixture') && (
        <View style={{ gap: space.s }}>
          {dalil.textAr ? <ArabicText>{dalil.textAr}</ArabicText> : null}
          <T>{dalil.translation}</T>
          <T variant="muted">
            {dalil.grading
              ? t('dalil.grading', { grading: dalil.grading })
              : t('dalil.gradingNotStated')}
          </T>
        </View>
      )}
      <T variant="small" style={{ fontWeight: '700' }}>
        {label}
      </T>
    </Card>
  );
}
