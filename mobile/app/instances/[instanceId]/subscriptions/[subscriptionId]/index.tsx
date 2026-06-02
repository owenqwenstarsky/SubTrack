import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSubscription, getSubscriptionDetails } from '@/lib/api';
import {
  formatBillingInterval,
  formatDate,
  formatDaysUntil,
  formatMoney,
} from '@/lib/format';
import { getInstance } from '@/lib/instances';
import type { SubscriptionDetails, SubTrackInstance } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValueRow,
  LoadingState,
  Pill,
  ScreenHeader,
  SectionHeader,
} from '@/ui/components';
import { colors, radii, spacing, typography } from '@/ui/theme';

type Status = 'loading' | 'ready' | 'error';

export default function SubscriptionDetailsPage() {
  const router = useRouter();
  const { instanceId, subscriptionId } = useLocalSearchParams<{
    instanceId: string;
    subscriptionId: string;
  }>();
  const [instance, setInstance] = useState<SubTrackInstance | null>(null);
  const [details, setDetails] = useState<SubscriptionDetails | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!instanceId || !subscriptionId) return;
      if (mode === 'initial') setStatus('loading');
      if (mode === 'refresh') setRefreshing(true);
      try {
        const loadedInstance = await getInstance(instanceId);
        if (!loadedInstance) throw new Error('Instance not found on this device.');
        setInstance(loadedInstance);
        const loaded = await getSubscriptionDetails(loadedInstance, subscriptionId);
        setDetails(loaded);
        setStatus('ready');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription');
        setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [instanceId, subscriptionId],
  );

  useFocusEffect(
    useCallback(() => {
      load('initial');
    }, [load]),
  );

  function confirmDelete() {
    if (!instance || !details) return;
    Alert.alert(
      'Delete subscription',
      `Permanently delete "${details.subscription.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteSubscription(instance, details.subscription.id);
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

  function openWebsite(url: string) {
    const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    Linking.openURL(target).catch(() => {
      Alert.alert('Couldn\'t open link', target);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title={details?.subscription.name ?? 'Subscription'}
        subtitle={instance?.name}
        onBack={() => router.push(`/instances/${instanceId}`)}
        backLabel="Back"
      />
      {status === 'loading' ? (
        <LoadingState label="Loading subscription" />
      ) : status === 'error' || !details ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={() => load('initial')} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
          }
        >
          <Card style={styles.heroCard}>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                {details.subscription.category ? (
                  <Pill label={details.subscription.category} tone="primary" />
                ) : null}
                <Text style={styles.heroAmount}>
                  {formatMoney(details.subscription.amount, details.subscription.currency)}
                </Text>
                <Text style={styles.heroInterval}>
                  {formatBillingInterval(
                    details.subscription.billingInterval,
                    details.subscription.billingIntervalCount,
                  )}
                </Text>
              </View>
              <View style={styles.heroSide}>
                <Text style={styles.heroSideLabel}>Next payment</Text>
                <Text style={styles.heroSideValue}>
                  {formatDate(details.subscription.nextPaymentDate)}
                </Text>
                <Pill
                  label={formatDaysUntil(details.stats.daysUntilNextPayment)}
                  tone={
                    details.stats.daysUntilNextPayment < 0
                      ? 'danger'
                      : details.stats.daysUntilNextPayment <= 3
                        ? 'warning'
                        : 'primary'
                  }
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </View>
          </Card>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Total paid</Text>
              <Text style={styles.statValue}>
                {formatMoney(details.stats.totalPaid, details.stats.currency)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Payments made</Text>
              <Text style={styles.statValue}>{details.stats.paymentsMade}</Text>
            </View>
          </View>

          <Card style={styles.section}>
            <SectionHeader title="Details" />
            <KeyValueRow
              label="First payment"
              value={formatDate(details.subscription.firstPaymentDate)}
            />
            <KeyValueRow
              label="Next payment"
              value={formatDate(details.subscription.nextPaymentDate)}
            />
            <KeyValueRow
              label="Billing"
              value={formatBillingInterval(
                details.subscription.billingInterval,
                details.subscription.billingIntervalCount,
              )}
            />
            <KeyValueRow
              label="Category"
              value={details.subscription.category ?? '—'}
            />
            {details.subscription.website ? (
              <View style={styles.linkRow}>
                <Text style={styles.kvLabel}>Website</Text>
                <Pressable onPress={() => openWebsite(details.subscription.website!)} hitSlop={8}>
                  <Text style={styles.linkValue} numberOfLines={1}>
                    {details.subscription.website}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <KeyValueRow label="Website" value="—" />
            )}
          </Card>

          {details.subscription.description ? (
            <Card style={styles.section}>
              <SectionHeader title="Description" />
              <Text style={styles.bodyText}>{details.subscription.description}</Text>
            </Card>
          ) : null}

          {details.subscription.notes ? (
            <Card style={styles.section}>
              <SectionHeader title="Notes" />
              <Text style={styles.bodyText}>{details.subscription.notes}</Text>
            </Card>
          ) : null}

          <View style={styles.actionsRow}>
            <Button
              label="Edit"
              onPress={() =>
                router.push(`/instances/${instanceId}/subscriptions/${subscriptionId}/edit`)
              }
              size="lg"
              style={{ flex: 1 }}
            />
            <Button
              label={deleting ? 'Deleting…' : 'Delete'}
              variant="dangerGhost"
              onPress={confirmDelete}
              loading={deleting}
              size="lg"
              style={{ flex: 1 }}
            />
          </View>

          <SectionHeader title={`Past payments (${details.pastPayments.length})`} />
          {details.pastPayments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              message="Past payments will appear here once the first billing date has passed."
            />
          ) : (
            <Card style={{ padding: 0 }}>
              {details.pastPayments.map((payment, index) => (
                <View
                  key={`${payment.paymentDate}-${index}`}
                  style={[
                    styles.paymentRow,
                    index === details.pastPayments.length - 1 && styles.paymentRowLast,
                  ]}
                >
                  <View>
                    <Text style={styles.paymentDate}>{formatDate(payment.paymentDate)}</Text>
                    <Text style={styles.paymentCaption}>Payment #{details.pastPayments.length - index}</Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    {formatMoney(payment.amount, payment.currency)}
                  </Text>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  heroCard: { padding: spacing.lg },
  heroRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  heroAmount: { ...typography.display, marginTop: spacing.sm },
  heroInterval: { ...typography.caption, marginTop: 2 },
  heroSide: { alignItems: 'flex-end' },
  heroSideLabel: { ...typography.caption },
  heroSideValue: { ...typography.bodyMedium, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  statLabel: { ...typography.caption },
  statValue: { ...typography.heading, marginTop: spacing.xs },

  section: { marginTop: spacing.lg },
  bodyText: { ...typography.body, lineHeight: 22, marginTop: spacing.xs },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.lg,
  },
  kvLabel: { ...typography.caption, flexShrink: 0 },
  linkValue: { ...typography.bodyMedium, color: colors.primary, textAlign: 'right' },

  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },

  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentRowLast: { borderBottomWidth: 0 },
  paymentDate: { ...typography.bodyMedium },
  paymentCaption: { ...typography.caption, marginTop: 2 },
  paymentAmount: { ...typography.heading },
});
