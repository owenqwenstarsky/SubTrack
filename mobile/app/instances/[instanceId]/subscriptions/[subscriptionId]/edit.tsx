import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  deleteSubscription,
  getSubscription,
  updateSubscription,
} from '@/lib/api';
import { getInstance } from '@/lib/instances';
import type {
  Subscription,
  SubscriptionInput,
  SubTrackInstance,
} from '@/lib/types';
import {
  Button,
  ErrorState,
  LoadingState,
  ScreenHeader,
} from '@/ui/components';
import { colors, spacing } from '@/ui/theme';
import {
  SubscriptionForm,
  subscriptionToFormValues,
} from '@/forms/SubscriptionForm';

export default function EditSubscriptionPage() {
  const router = useRouter();
  const { instanceId, subscriptionId } = useLocalSearchParams<{
    instanceId: string;
    subscriptionId: string;
  }>();
  const [instance, setInstance] = useState<SubTrackInstance | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!instanceId || !subscriptionId) return;
      setStatus('loading');
      try {
        const loadedInstance = await getInstance(instanceId);
        if (cancelled) return;
        if (!loadedInstance) {
          setLoadError('Instance not found on this device.');
          setStatus('error');
          return;
        }
        const { subscription: loaded } = await getSubscription(loadedInstance, subscriptionId);
        if (cancelled) return;
        setInstance(loadedInstance);
        setSubscription(loaded);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load subscription');
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instanceId, subscriptionId]);

  async function handleSubmit(input: SubscriptionInput) {
    if (!instance || !subscription) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateSubscription(instance, subscription.id, input);
      router.replace(`/instances/${instance.id}/subscriptions/${subscription.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save subscription');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete() {
    if (!instance || !subscription) return;
    Alert.alert(
      'Delete subscription',
      `Permanently delete "${subscription.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteSubscription(instance, subscription.id);
              router.replace(`/instances/${instance.id}`);
            } catch (err) {
              setDeleting(false);
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title="Edit subscription"
        subtitle={subscription?.name}
        onBack={() => router.back()}
        backLabel="Back"
      />
      {status === 'loading' ? (
        <LoadingState label="Loading subscription" />
      ) : status === 'error' || !instance || !subscription ? (
        <ErrorState
          message={loadError ?? 'Unknown error'}
          onRetry={() => router.replace(`/instances/${instanceId}`)}
        />
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
              initialValues={subscriptionToFormValues(subscription)}
              submitLabel="Save changes"
              submitting={submitting}
              errorMessage={submitError}
              onSubmit={handleSubmit}
              onCancel={() => router.back()}
              secondaryAction={
                <Button
                  label={deleting ? 'Deleting…' : 'Delete subscription'}
                  variant="dangerGhost"
                  onPress={confirmDelete}
                  loading={deleting}
                  disabled={submitting}
                  style={{ marginTop: spacing.sm }}
                />
              }
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
