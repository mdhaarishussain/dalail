import { Stack } from 'expo-router';
import { useState } from 'react';
import { useT } from '../i18n/useT';
import { runSearch } from '../search/runSearch';
import { useServices } from '../services/ServicesContext';
import { useRepo } from '../services/useRepo';
import { Button, Card, Screen, T } from '../ui/components';
import parity from '../diagnostics/parity.json';

export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0, na = 0, nb = 0; // prettier-ignore
  a.forEach((x, i) => {
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  });
  return dot / Math.sqrt(na * nb);
}

/** Dev-only: embedding parity with the pipeline (target > 0.99) and retrieval latency. */
export default function Diagnostics() {
  const t = useT();
  const services = useServices();
  const repo = useRepo();
  const [parityResult, setParity] = useState<string>('');
  const [latency, setLatency] = useState<string>('');

  const runParity = async () => {
    if (!services.embedQuery) {
      setParity(t('diag.noEmbedder'));
      return;
    }
    const scores: number[] = [];
    for (const item of parity.items) {
      const v = await services.embedQuery(item.text, '');
      scores.push(v ? cosine(v, item.vector) : 0);
    }
    const min = Math.min(...scores);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const line = `${min >= parity.threshold ? 'PASS' : 'FAIL'} — min ${min.toFixed(4)}, mean ${mean.toFixed(4)} (n=${scores.length})`;
    setParity(line);
    // Also readable over USB: adb logcat -s ReactNativeJS | grep dalail-parity
    console.log(
      `[dalail-parity] ${line} model=${parity.embed_model} per-item=${scores.map((x) => x.toFixed(4)).join(',')}`,
    );
  };

  const runLatency = async () => {
    const qs = ['qalam aur kitaab', 'window and door', 'ghar', 'cricket match ka score'];
    const times: number[] = [];
    for (const q of qs) {
      const t0 = Date.now();
      await runSearch(q, { repo, embedQuery: services.embedQuery });
      times.push(Date.now() - t0);
    }
    setLatency(`${times.join(' / ')} ms (max ${Math.max(...times)} ms)`);
  };

  const d = services.diagnostics;
  return (
    <Screen>
      <Stack.Screen options={{ title: t('settings.diagnostics') }} />
      <Card>
        <T>sqlite-vec: {d?.vecVersion ?? '—'}</T>
        <T>model: {d?.modelPath ?? '—'}</T>
        <T testID="model-status">model check: {d?.modelStatus ?? '—'}</T>
        <T>embed_model (DB): {services.meta.embedModel}</T>
        <T>init: {d?.initMs ?? '—'} ms</T>
      </Card>
      <Button label={t('diag.runParity')} onPress={() => void runParity()} />
      {parityResult ? <T testID="parity-result">{parityResult}</T> : null}
      <Button kind="secondary" label={t('diag.runLatency')} onPress={() => void runLatency()} />
      {latency ? <T>{latency}</T> : null}
    </Screen>
  );
}
