import { configure } from '@testing-library/react-native';

// First renders of the full router tree are slow under Jest; give async queries room.
configure({ asyncUtilTimeout: 15000 });
