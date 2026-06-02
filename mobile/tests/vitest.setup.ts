import { vi } from 'vitest';

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  Pressable: 'Pressable',
  StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View',
}));
