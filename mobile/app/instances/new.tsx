import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { testInstanceConnection } from '@/lib/api';
import { deleteInstance, saveInstance } from '@/lib/instances';
import { Button, Field, ScreenHeader } from '@/ui/components';
import { colors, radii, spacing } from '@/ui/theme';

type Errors = {
  name?: string;
  baseUrl?: string;
  password?: string;
};

function validateUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return 'Enter your SubTrack URL';
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost') {
      return 'Enter a complete URL, including the domain';
    }
    return null;
  } catch {
    return 'Enter a valid URL';
  }
}

export default function AddInstancePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const nextErrors: Errors = {};
    const urlError = validateUrl(baseUrl);
    if (urlError) nextErrors.baseUrl = urlError;
    if (!password) {
      nextErrors.password = 'Enter the SubTrack password';
    } else if (password.length < 4) {
      nextErrors.password = 'Password must be at least 4 characters';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    let savedId: string | null = null;
    try {
      const instance = await saveInstance({
        name: name.trim() || undefined,
        baseUrl,
        password,
      });
      savedId = instance.id;
      await testInstanceConnection(instance);
      router.replace(`/instances/${instance.id}`);
    } catch (err) {
      if (savedId) {
        try {
          await deleteInstance(savedId);
        } catch {
          // Ignore cleanup errors.
        }
      }
      const message = err instanceof Error ? err.message : 'Unable to connect to SubTrack';
      setSubmitError(formatConnectionError(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title="Connect an instance"
        subtitle="We'll verify the URL and password before saving."
        onBack={() => router.back()}
        backLabel="Instances"
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >

          <Field
            label="Instance name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
            helperText="Optional. Defaults to the URL hostname."
            editable={!submitting}
          />

          <Field
            label="SubTrack URL"
            required
            value={baseUrl}
            onChangeText={(value) => {
              setBaseUrl(value);
              if (errors.baseUrl) setErrors((prev) => ({ ...prev, baseUrl: undefined }));
            }}
            autoCapitalize="none"
            autoComplete="url"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="next"
            errorText={errors.baseUrl}
            helperText="Example: https://subtrack.yourdomain.com"
            editable={!submitting}
          />

          <Field
            label="Password"
            required
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            errorText={errors.password}
            editable={!submitting}
          />

          {submitError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerTitle}>Couldn't connect</Text>
              <Text style={styles.errorBannerMessage}>{submitError}</Text>
            </View>
          ) : null}

          <Button
            label={submitting ? 'Connecting…' : 'Save and connect'}
            onPress={handleSubmit}
            loading={submitting}
            size="lg"
            fullWidth
            style={{ marginTop: spacing.md }}
          />
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => router.back()}
            disabled={submitting}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatConnectionError(message: string) {
  if (message.includes('Invalid password')) return 'The password was rejected by the server.';
  if (message.includes('Network request failed')) {
    return 'Could not reach the server. Check the URL and your connection.';
  }
  return message;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerTitle: { color: colors.danger, fontWeight: '600', marginBottom: 2 },
  errorBannerMessage: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
