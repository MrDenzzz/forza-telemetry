import { jest } from '@jest/globals';
import { setUpTests } from 'react-native-reanimated';

// Shared values and animated styles run on the JavaScript thread in tests.
setUpTests();

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// The provider waits for insets from the native side, which tests do not have.
jest.mock(
  'react-native-safe-area-context',
  () =>
    jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);
