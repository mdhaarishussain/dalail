import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { Locale } from '../i18n';

export type ModeOverride = 'auto' | 'full' | 'lite';
export type DalilTranslation = 'ur' | 'en' | 'both';

export interface Entry {
  q: string;
  at: string;
}

interface Data {
  language: Locale;
  onboarded: boolean;
  mode: ModeOverride;
  dalilTranslation: DalilTranslation;
  /** Dev builds only: include draft / under-review nodes (always shown with an UNVERIFIED banner). */
  showUnverified: boolean;
  /** Dev builds only: include the AI-extracted research set (ADR 0008). */
  showResearch: boolean;
  recents: Entry[];
  bookmarks: string[];
  savedQuestions: Entry[];
  /** Claims visited in the current debate, oldest first. */
  debatePath: string[];
}

interface Actions {
  set: (patch: Partial<Data>) => void;
  addRecent: (q: string) => void;
  toggleBookmark: (nodeId: string) => void;
  saveQuestion: (q: string) => void;
  removeSavedQuestion: (at: string) => void;
  visit: (nodeId: string) => void;
  jumpTo: (nodeId: string) => void;
  newDebate: () => void;
}

export type UserState = Data & Actions & { hydrated: boolean };

export const MAX_RECENTS = 20;
const now = () => new Date().toISOString();

export const initialData: Data = {
  language: 'en',
  onboarded: false,
  mode: 'auto',
  dalilTranslation: 'both',
  showUnverified: true,
  showResearch: true,
  recents: [],
  bookmarks: [],
  savedQuestions: [],
  debatePath: [],
};

let storage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/** Must be called before `hydrateUserStore()`. Device: op-sqlite Storage; tests: memory. */
export function configureUserStorage(s: StateStorage): void {
  storage = s;
}

export const useUser = create<UserState>()(
  persist(
    (set, get) => ({
      ...initialData,
      hydrated: false,
      set: (patch) => set(patch),
      addRecent: (q) => {
        const t = q.trim();
        if (!t) return;
        set({
          recents: [{ q: t, at: now() }, ...get().recents.filter((r) => r.q !== t)].slice(
            0,
            MAX_RECENTS,
          ),
        });
      },
      toggleBookmark: (id) => {
        const b = get().bookmarks;
        set({ bookmarks: b.includes(id) ? b.filter((x) => x !== id) : [id, ...b] });
      },
      saveQuestion: (q) => {
        const t = q.trim();
        if (t && !get().savedQuestions.some((s) => s.q === t)) {
          set({ savedQuestions: [{ q: t, at: now() }, ...get().savedQuestions] });
        }
      },
      removeSavedQuestion: (at) =>
        set({ savedQuestions: get().savedQuestions.filter((s) => s.at !== at) }),
      visit: (id) => {
        const p = get().debatePath;
        if (p[p.length - 1] !== id) set({ debatePath: [...p, id] });
      },
      jumpTo: (id) => {
        const p = get().debatePath;
        const i = p.lastIndexOf(id);
        if (i >= 0) set({ debatePath: p.slice(0, i + 1) });
      },
      newDebate: () => set({ debatePath: [] }),
    }),
    {
      name: 'dalail-user',
      version: 1,
      storage: createJSONStorage(() => storage),
      skipHydration: true,
      partialize: ({ hydrated: _hydrated, ...rest }) =>
        Object.fromEntries(
          Object.entries(rest).filter(([, v]) => typeof v !== 'function'),
        ) as Partial<UserState>,
      onRehydrateStorage: () => () => useUser.setState({ hydrated: true }),
    },
  ),
);

export async function hydrateUserStore(): Promise<void> {
  await useUser.persist.rehydrate();
  useUser.setState({ hydrated: true });
}
