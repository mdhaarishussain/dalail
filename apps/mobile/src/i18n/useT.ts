import { useCallback } from 'react';
import { useUser } from '../state/userStore';
import { t, type StringKey } from './index';

export function useT() {
  const language = useUser((s) => s.language);
  return useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => t(key, language, vars),
    [language],
  );
}
