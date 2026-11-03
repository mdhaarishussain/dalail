import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { ReactElement } from 'react';
import { router } from 'expo-router';
import { ServicesProvider, type Services } from '../services/ServicesContext';
import { useUser } from '../state/userStore';
import Ask from '../screens/Ask';
import BrowseTopic from '../screens/BrowseTopic';
import DalilDetail from '../screens/DalilDetail';
import Onboarding from '../screens/Onboarding';
import Rebuttal from '../screens/Rebuttal';
import Results from '../screens/Results';
import Saved, { savedQuestionsExport } from '../screens/Saved';
import Settings from '../screens/Settings';
import { resetUser, testServices } from './helpers';

const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => mockParams.current,
    Stack: { Screen: () => null },
    Redirect: ({ href }: { href: string }) => <Text>{`redirect:${href}`}</Text>,
  };
});
const push = router.push as jest.Mock;
const replace = router.replace as jest.Mock;

let services: Services;
beforeAll(async () => {
  services = await testServices();
});
beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  mockParams.current = {};
});

async function show(ui: ReactElement, params: Record<string, string> = {}) {
  mockParams.current = params;
  return render(<ServicesProvider services={services}>{ui}</ServicesProvider>);
}

const claim = (topic: string, n: number) =>
  new RegExp(`FIXTURE: claim text for ${topic} node ${n}\\b`);

describe('onboarding', () => {
  beforeEach(() => resetUser({ onboarded: false }));

  it('redirects first-time users from Ask to onboarding', async () => {
    await show(<Ask />);
    expect(await screen.findByText('redirect:/onboarding')).toBeTruthy();
  });

  it('picks a language, explains the app, shows the device tier and finishes', async () => {
    await show(<Onboarding />);
    await fireEvent.press(screen.getByLabelText('Roman Urdu'));
    expect(useUser.getState().language).toBe('roman-ur');
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(await screen.findByText('Dalail kaise kaam karta hai')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    expect(await screen.findByText('Lite mode')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('onboarding-done'));
    expect(useUser.getState().onboarded).toBe(true);
    expect(replace).toHaveBeenCalledWith('/');
  });
});

describe('Ask', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  it('submits the query and lists topics', async () => {
    await show(<Ask />);
    expect(await screen.findByLabelText('Tawassul')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('ask-input'), 'kalam aur kitab');
    await fireEvent.press(screen.getByTestId('ask-submit'));
    expect(push).toHaveBeenCalledWith({ pathname: '/results', params: { q: 'kalam aur kitab' } });
  });
});

describe('Results', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  it('goes straight to the rebuttal on a clear match and records the query', async () => {
    await show(<Results />, { q: 'kalam aur kitab' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/node/fixture-tawassul-001'));
    expect(useUser.getState().recents[0]?.q).toBe('kalam aur kitab');
  });

  it('asks "Did you mean…?" when two claims are close', async () => {
    await show(<Results />, { q: 'ghar' });
    expect(
      await screen.findByText('A few claims are close. Pick the one they are making.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('candidate-fixture-istighatha-004'));
    expect(replace).toHaveBeenCalledWith('/node/fixture-istighatha-004');
    expect(screen.getByTestId('candidate-fixture-tawassul-004')).toBeTruthy();
  });

  it('finds Urdu-script queries typed with Arabic letter variants', async () => {
    await show(<Results />, { q: 'قلم اور كتاب' });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/node/fixture-tawassul-001'));
  });

  it('offers to save an unanswered question', async () => {
    await show(<Results />, { q: 'cricket match ka score' });
    await fireEvent.press(await screen.findByTestId('save-question'));
    expect(useUser.getState().savedQuestions.map((s) => s.q)).toEqual(['cricket match ka score']);
  });
});

describe('Rebuttal', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  it('shows claim, quick reply, dalail and follow-ups, and records the debate path', async () => {
    await show(<Rebuttal />, { id: 'fixture-tawassul-001' });
    expect(await screen.findByText(claim('tawassul', 1))).toBeTruthy();
    expect(screen.getByTestId('short-answer')).toBeTruthy();
    expect(screen.getByTestId('fixture-banner')).toBeTruthy();
    expect(await screen.findByTestId('dalil-fixture:hadith:1')).toBeTruthy();
    expect(screen.getByText('Grading: FIXTURE: grading placeholder 1')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('followup-fixture-tawassul-002'));
    expect(push).toHaveBeenCalledWith('/node/fixture-tawassul-002');
    expect(useUser.getState().debatePath).toEqual(['fixture-tawassul-001']);
  });

  it('never allows sharing fixture content', async () => {
    await show(<Rebuttal />, { id: 'fixture-tawassul-001' });
    const share = await screen.findByTestId('share');
    expect(share.props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByText('Only verified answers can be shared.')).toBeTruthy();
  });

  it('shows an UNVERIFIED banner on drafts', async () => {
    await show(<Rebuttal />, { id: 'fixture-tawassul-005' });
    expect(await screen.findByTestId('unverified-banner')).toBeTruthy();
  });

  it('hides drafts when the dev "show unverified" toggle is off', async () => {
    resetUser({ onboarded: true, showUnverified: false });
    await show(<Rebuttal />, { id: 'fixture-tawassul-005' });
    expect(await screen.findByText('This claim is not available.')).toBeTruthy();
  });

  it('renders an Urdu-script body right-to-left with chips', async () => {
    await show(<Rebuttal />, { id: 'fixture-istighatha-006' });
    await fireEvent.press(await screen.findByTestId('expand-response'));
    expect(await screen.findByTestId('markdown-rtl')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Dalil quran 6'));
    expect(push).toHaveBeenCalledWith({
      pathname: '/dalil/[ref]',
      params: { ref: 'fixture:quran:6' },
    });
  });

  it('bookmarks', async () => {
    await show(<Rebuttal />, { id: 'fixture-tawassul-002' });
    await fireEvent.press(await screen.findByTestId('bookmark'));
    expect(useUser.getState().bookmarks).toEqual(['fixture-tawassul-002']);
  });
});

describe('Dalil detail', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  it('says when no grading is stated and lists citing claims', async () => {
    await show(<DalilDetail />, { ref: 'fixture:hadith:2' });
    expect(await screen.findByText('Grading: not stated')).toBeTruthy();
    expect(await screen.findByText('Also cited in')).toBeTruthy();
  });
});

describe('Browse, Saved, Settings', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  it('filters claims by opponent', async () => {
    await show(<BrowseTopic />, { topic: 'istighatha' });
    expect(await screen.findByTestId('claim-fixture-istighatha-001')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Rawafidh'));
    expect(await screen.findByText('No claims here yet.')).toBeTruthy();
  });

  it('lists bookmarks and saved questions; export format is stable', async () => {
    resetUser({
      onboarded: true,
      bookmarks: ['fixture-tawassul-002'],
      savedQuestions: [{ q: 'x?', at: 't1' }],
    });
    await show(<Saved />);
    expect(await screen.findByText(claim('tawassul', 2))).toBeTruthy();
    expect(screen.getByText('x?')).toBeTruthy();
    expect(savedQuestionsExport([{ q: 'x?', at: 't1' }], '0.1.0')).toMatchObject({
      kind: 'dalail-saved-questions',
      corpus_version: '0.1.0',
      questions: [{ q: 'x?', saved_at: 't1' }],
    });
  });

  it('shows corpus version and dev-only controls on a dev build', async () => {
    await show(<Settings />);
    expect(await screen.findByText('Content version 0.1.0')).toBeTruthy();
    expect(screen.getByText('Show unverified answers')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Roman Urdu'));
    expect(useUser.getState().language).toBe('roman-ur');
  });

  it('hides dev controls on a prod build', async () => {
    services = { ...services, meta: { ...services.meta, buildMode: 'prod' } };
    await show(<Settings />);
    expect(await screen.findByText('Content')).toBeTruthy();
    expect(screen.queryByText('Show unverified answers')).toBeNull();
    services = await testServices();
  });
});

describe('research nodes (dev builds, ADR 0008)', () => {
  beforeEach(() => resetUser({ onboarded: true }));

  async function researchNodeWithEverything(): Promise<string> {
    const rows = await services.repo.exec.all(
      `SELECT e.to_id AS id FROM edges e JOIN nodes n ON n.id = e.to_id
        WHERE e.kind = 'counters' AND n.research_json LIKE '%"candidate_responses": [{%' LIMIT 1`,
    );
    return String(rows[0]?.id);
  }

  it('shows banner, move type, candidate response with watch link, ask-back; no quick reply or share', async () => {
    const id = await researchNodeWithEverything();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await show(<Rebuttal />, { id });
    expect(await screen.findByTestId('research-banner')).toBeTruthy();
    expect(screen.getByText('AI-extracted from video — not verified by scholars')).toBeTruthy();
    expect(screen.getByTestId('candidate-response-0')).toBeTruthy();
    expect(screen.getByText('Ask them back')).toBeTruthy();
    expect(screen.queryByTestId('short-answer')).toBeNull();
    expect(screen.queryByTestId('share')).toBeNull();
    expect(screen.queryByText('Quick reply')).toBeNull();
    const watch = screen.getAllByText(/^Watch at /);
    await fireEvent.press(watch[0] as never);
    expect(open).toHaveBeenCalledWith(expect.stringMatching(/youtube\.com\/watch\?v=.+&t=\d+s$/));
    open.mockRestore();
  });

  it('is hidden when "Show research content" is off', async () => {
    const id = await researchNodeWithEverything();
    resetUser({ onboarded: true, showResearch: false });
    await show(<Rebuttal />, { id });
    expect(await screen.findByText('This claim is not available.')).toBeTruthy();
  });

  it('settings show the research toggle on dev builds', async () => {
    await show(<Settings />);
    expect(await screen.findByText('Show research content')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Show research content'));
    expect(useUser.getState().showResearch).toBe(false);
  });
});
