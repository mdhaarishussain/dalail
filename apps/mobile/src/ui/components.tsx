import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fonts, radius, space, type, useColors } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const body = <View style={styles.screenInner}>{children}</View>;
  return (
    <SafeAreaView
      style={[styles.flex, { backgroundColor: c.bg }]}
      edges={['left', 'right', 'bottom']}
    >
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'small' | 'muted';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  const c = useColors();
  const v = {
    title: { fontSize: type.title, fontWeight: '700' as const, color: c.text },
    heading: { fontSize: type.heading, fontWeight: '600' as const, color: c.text },
    body: { fontSize: type.body, lineHeight: type.body * 1.5, color: c.text },
    small: { fontSize: type.small, lineHeight: type.small * 1.45, color: c.text },
    muted: { fontSize: type.small, lineHeight: type.small * 1.45, color: c.muted },
  }[variant];
  return <Text {...rest} style={[v, style]} />;
}

/** Arabic (Quran / hadith as stored): Amiri, right-to-left, larger than body text. */
export function ArabicText({ style, ...rest }: TextProps) {
  const c = useColors();
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts.arabic,
          fontSize: type.arabic,
          lineHeight: type.arabic * 1.9,
          color: c.text,
        },
        styles.rtl,
        style,
      ]}
    />
  );
}

/** Urdu script (Kanz ul Iman, Urdu-language bodies): Nastaliq, right-to-left, generous line height. */
export function UrduText({ style, ...rest }: TextProps) {
  const c = useColors();
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: fonts.urdu, fontSize: type.urdu, lineHeight: type.urdu * 2.3, color: c.text },
        styles.rtl,
        style,
      ]}
    />
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  accessibilityHint,
  testID,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? c.primary : c.surface,
          borderColor: primary ? c.primary : c.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={{ color: primary ? c.onPrimary : c.text, fontSize: type.body, fontWeight: '600' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress)
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  onPress,
  selected,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c.primary : c.chip }]}
    >
      <Text
        style={{
          color: selected ? c.onPrimary : c.onChip,
          fontSize: type.small,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <View style={[styles.row, wrap && styles.wrap]}>{children}</View>;
}

export function Banner({
  text,
  tone = 'warn',
  testID,
}: {
  text: string;
  tone?: 'warn' | 'danger';
  testID?: string;
}) {
  const c = useColors();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={[styles.banner, { backgroundColor: tone === 'warn' ? c.warnBg : c.dangerBg }]}
    >
      <Text
        style={{
          color: tone === 'warn' ? c.warnText : c.dangerText,
          fontWeight: '700',
          fontSize: type.small,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <T variant="heading" accessibilityRole="header">
        {title}
      </T>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  screenInner: { padding: space.l, gap: space.l },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  button: {
    minHeight: 48,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderRadius: radius.m,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderWidth: 1, borderRadius: radius.l, padding: space.l, gap: space.s },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    borderRadius: 999,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: space.s, alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  banner: { padding: space.m, borderRadius: radius.s },
  section: { gap: space.m },
});
