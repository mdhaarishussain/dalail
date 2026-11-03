import { render, screen } from '@testing-library/react-native';
import PlaceholderScreen from '../app/index';
import { t } from '../i18n';

describe('PlaceholderScreen', () => {
  it('renders the localised title and subtitle', async () => {
    await render(<PlaceholderScreen />);
    expect(screen.getByText(t('placeholder.title'))).toBeTruthy();
    expect(screen.getByText(t('placeholder.subtitle'))).toBeTruthy();
  });
});
