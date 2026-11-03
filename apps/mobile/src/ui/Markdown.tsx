import { Text, View } from 'react-native';
import { parseDalilRef } from '@dalail/core';
import { parseMarkdown, type Inline } from './markdown';
import { fonts, RTL_LANGS, space, type, useColors } from './theme';

function refLabel(ref: string): string {
  const p = parseDalilRef(ref);
  if (!p) return ref;
  if (p.kind === 'quran') return `${p.surah}:${p.from === p.to ? p.from : `${p.from}-${p.to}`}`;
  if (p.kind === 'hadith') return p.id;
  return `${p.collection} ${p.n}`;
}

/** Renders stored body text exactly (no rewriting); `[[ref]]` become tappable chips. */
export function Markdown({
  md,
  lang,
  onRef,
}: {
  md: string;
  lang: string;
  onRef: (ref: string) => void;
}) {
  const c = useColors();
  const rtl = RTL_LANGS.has(lang.split('-')[0] ?? '');
  const base = rtl
    ? {
        fontFamily: fonts.urdu,
        fontSize: type.urdu,
        lineHeight: type.urdu * 2.3,
        writingDirection: 'rtl' as const,
        textAlign: 'right' as const,
      }
    : { fontSize: type.body, lineHeight: type.body * 1.55 };

  const inline = (parts: Inline[]) =>
    parts.map((p, i) =>
      p.kind === 'ref' ? (
        <Text
          key={i}
          accessibilityRole="link"
          accessibilityLabel={`Dalil ${refLabel(p.ref)}`}
          onPress={() => onRef(p.ref)}
          style={{ color: c.onChip, backgroundColor: c.chip, fontWeight: '700' }}
        >
          {` ${refLabel(p.ref)} `}
        </Text>
      ) : (
        <Text
          key={i}
          style={{
            fontWeight: p.bold ? '700' : undefined,
            fontStyle: p.italic ? 'italic' : undefined,
          }}
        >
          {p.text}
        </Text>
      ),
    );

  return (
    <View style={{ gap: space.m }} testID={rtl ? 'markdown-rtl' : 'markdown-ltr'}>
      {parseMarkdown(md).map((b, i) => {
        if (b.kind === 'list') {
          return (
            <View key={i} style={{ gap: space.xs }}>
              {b.items.map((item, j) => (
                <Text key={j} style={[base, { color: c.text }]}>
                  {b.ordered ? `${j + 1}. ` : '• '}
                  {inline(item)}
                </Text>
              ))}
            </View>
          );
        }
        return (
          <Text
            key={i}
            accessibilityRole={b.kind === 'heading' ? 'header' : undefined}
            style={[base, { color: c.text, fontWeight: b.kind === 'heading' ? '700' : undefined }]}
          >
            {inline(b.inline)}
          </Text>
        );
      })}
    </View>
  );
}
