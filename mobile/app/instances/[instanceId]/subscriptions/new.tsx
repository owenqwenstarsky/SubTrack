import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createSubscription } from '@/lib/api';
import { getInstance } from '@/lib/instances';
import type { SubscriptionInput, SubTrackInstance } from '@/lib/types';
import {
  ErrorState,
  LoadingState,
  ScreenHeader,
} from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
import {
  SubscriptionForm,
  subscriptionToFormValues,
} from '@/forms/SubscriptionForm';

export default function AddSubscriptionPage() {
  const router = useRouter();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const [instance, setInstance] = useState<SubTrackInstance | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!instanceId) return;
      setStatus('loading');
      try {
        const loaded = await getInstance(instanceId);
        if (cancelled) return;
        if (!loaded) {
          setLoadError('Instance not found on this device.');
          setStatus('error');
          return;
        }
        setInstance(loaded);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load instance');
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  async function handleSubmit(input: SubscriptionInput) {
    if (!instance) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createSubscription(instance, input);
      router.replace(`/instances/${instance.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save subscription');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title="Add subscription"
        subtitle={instance?.name}
        onBack={() => router.back()}
        backLabel="Back"
      />
      {status === 'loading' ? (
        <LoadingState label="Loading instance" />
      ) : status === 'error' || !instance ? (
        <ErrorState message={loadError ?? 'Unknown error'} onRetry={() => router.replace(`/instances/${instanceId}`)} />
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <SubscriptionForm
              initialValues={subscriptionToFormValues(null)}
              submitLabel="Save subscription"
              submitting={submitting}
              errorMessage={submitError}
              onSubmit={handleSubmit}
              onCancel={() => router.back()}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
