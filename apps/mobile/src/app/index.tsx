import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import { t } from '../i18n';

export default function PlaceholderScreen() {
  const dark = useColorScheme() === 'dark';
  const fg = dark ? '#F2F2F2' : '#1A1A1A';
  return (
    <View
      style={[styles.container, { backgroundColor: dark ? '#121212' : '#FAFAF7' }]}
      accessibilityRole="summary"
    >
      <Text style={[styles.title, { color: fg }]} accessibilityRole="header">
        {t('placeholder.title')}
      </Text>
      <Text style={[styles.subtitle, { color: fg }]}>{t('placeholder.subtitle')}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: '600' },
  subtitle: { fontSize: 18, textAlign: 'center', lineHeight: 26 },
});
