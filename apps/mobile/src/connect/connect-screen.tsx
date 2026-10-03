import { parseApiUrl } from '@ft/live-client';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';

export interface AddressSuggestion {
  readonly label: string;
  readonly url: string;
}

/**
 * Asks where the API runs. The phone and that computer need to be on the same network, and the
 * API must listen on all interfaces (its default).
 */
export function ConnectScreen({
  initialUrl,
  suggestions,
  onConnect,
}: {
  initialUrl: string;
  suggestions: readonly AddressSuggestion[];
  onConnect: (url: string) => void;
}) {
  const [address, setAddress] = useState(initialUrl);
  const [invalid, setInvalid] = useState(false);

  const connect = (input: string) => {
    const url = parseApiUrl(input);
    setInvalid(url === null);
    if (url !== null) {
      onConnect(url);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">
          Connect to the API
        </Text>
        <Text style={styles.hint}>
          The address of the computer running the API, on the same Wi-Fi as this phone.
        </Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, invalid && styles.inputInvalid]}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              setInvalid(false);
            }}
            onSubmitEditing={() => {
              connect(address);
            }}
            placeholder="192.168.1.20:4000"
            placeholderTextColor={colors.muted}
            accessibilityLabel="API address"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
          />
          <Pressable
            style={styles.button}
            onPress={() => {
              connect(address);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Connect</Text>
          </Pressable>
        </View>
        {invalid ? (
          <Text style={styles.error} accessibilityRole="alert">
            Enter an address such as 192.168.1.20:4000 or https://example.com
          </Text>
        ) : null}
        {suggestions.map(({ label, url }) => (
          <Pressable
            key={url}
            style={styles.suggestion}
            onPress={() => {
              setAddress(url);
              connect(url);
            }}
            accessibilityRole="button"
          >
            <Text style={styles.suggestionLabel}>{label}</Text>
            <Text style={styles.suggestionUrl}>{url}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    padding: spacing * 2,
    gap: spacing,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 14 },
  row: { flexDirection: 'row', gap: spacing },
  input: {
    flex: 1,
    paddingHorizontal: spacing,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: colors.panel,
    color: colors.text,
    fontSize: 16,
  },
  inputInvalid: { borderColor: colors.brake },
  button: {
    justifyContent: 'center',
    paddingHorizontal: spacing * 1.5,
    borderRadius: radius,
    backgroundColor: colors.accent,
  },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  error: { color: colors.brake, fontSize: 13 },
  suggestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
  },
  suggestionLabel: { color: colors.text, fontSize: 14 },
  suggestionUrl: { color: colors.muted, fontSize: 14 },
});
