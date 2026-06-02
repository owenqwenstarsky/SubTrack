import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSubscription, getSubscriptions } from '@/lib/api';
import {
  formatBillingInterval,
  formatDate,
  formatMoney,
} from '@/lib/format';
import { getInstance } from '@/lib/instances';
import type { Subscription, SubTrackInstance } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Pill,
  ScreenHeader,
} from '@/ui/components';
import { colors, radii, spacing, typography } from '@/ui/theme';

type Status = 'loading' | 'ready' | 'error';

export default function InstanceSubscriptionsPage() {
  const router = useRouter();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const [instance, setInstance] = useState<SubTrackInstance | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (!instanceId) return;
      if (mode === 'initial') setStatus('loading');
      if (mode === 'refresh') setRefreshing(true);
      try {
        const loadedInstance = await getInstance(instanceId);
        if (!loadedInstance) {
          throw new Error('Instance not found. It may have been removed from this device.');
        }
        setInstance(loadedInstance);
        const { subscriptions: list } = await getSubscriptions(loadedInstance);
        setSubscriptions(list);
        setStatus('ready');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscriptions');
        setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [instanceId],
  );

  useFocusEffect(
    useCallback(() => {
      load('initial');
    }, [load]),
  );

  const sorted = useMemo(
    () =>
      [...subscriptions].sort(
        (a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime(),
      ),
    [subscriptions],
  );

  const totals = useMemo(() => {
    if (!subscriptions.length) return null;
    const byCurrency = new Map<string, number>();
    for (const sub of subscriptions) {
      const monthly = monthlyEquivalent(sub);
      byCurrency.set(sub.currency, (byCurrency.get(sub.currency) ?? 0) + monthly);
    }
    return Array.from(byCurrency.entries()).map(([currency, total]) => ({
      currency,
      total,
    }));
  }, [subscriptions]);

  const confirmDelete = useCallback(
    (subscription: Subscription) => {
      if (!instance) return;
      Alert.alert(
        'Delete subscription',
        `Permanently delete "${subscription.name}"? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(subscription.id);
              try {
                await deleteSubscription(instance, subscription.id);
                setSubscriptions((prev) => prev.filter((item) => item.id !== subscription.id));
              } catch (err) {
                Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [instance],
  );

  const renderItem = ({ item }: { item: Subscription }) => {
    const nextDate = new Date(item.nextPaymentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(nextDate);
    next.setHours(0, 0, 0, 0);
    const daysUntil = Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const tone: 'danger' | 'warning' | 'primary' | 'neutral' =
      daysUntil < 0 ? 'danger' : daysUntil <= 3 ? 'warning' : daysUntil <= 14 ? 'primary' : 'neutral';
    const upcomingLabel =
      daysUntil === 0 ? 'Due today' : daysUntil === 1 ? 'Tomorrow' : daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `In ${daysUntil}d`;

    return (
      <Card
        style={styles.subCard}
        onPress={() =>
          router.push(`/instances/${instanceId}/subscriptions/${item.id}`)
        }
        accessibilityLabel={`Open ${item.name}`}
      >
        <View style={styles.subHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {item.category ? (
              <Text style={styles.subCategory} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
          </View>
          <View style={styles.subAmountWrap}>
            <Text style={styles.subAmount}>{formatMoney(item.amount, item.currency)}</Text>
            <Text style={styles.subInterval}>
              {formatBillingInterval(item.billingInterval, item.billingIntervalCount)}
            </Text>
          </View>
        </View>
        <View style={styles.subFooter}>
          <View style={styles.subNext}>
            <Pill label={upcomingLabel} tone={tone} />
            <Text style={styles.subNextDate}>{formatDate(item.nextPaymentDate)}</Text>
          </View>
          <View style={styles.subActions}>
            <Button
              label="Edit"
              size="sm"
              variant="secondary"
              onPress={() =>
                router.push(`/instances/${instanceId}/subscriptions/${item.id}/edit`)
              }
            />
            <Button
              label={deletingId === item.id ? 'Deleting…' : 'Delete'}
              size="sm"
              variant="dangerGhost"
              loading={deletingId === item.id}
              onPress={() => confirmDelete(item)}
            />
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title={instance?.name ?? 'Subscriptions'}
        subtitle={instance?.baseUrl}
        onBack={() => router.push('/')}
        backLabel="Instances"
      />
      {status === 'loading' ? (
        <LoadingState label="Loading subscriptions" />
      ) : status === 'error' ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={() => load('initial')} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, sorted.length === 0 && styles.listContentEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <View>
              {totals && totals.length > 0 ? (
                <View style={styles.totalsRow}>
                  {totals.map((entry) => (
                    <View key={entry.currency} style={styles.totalsCard}>
                      <Text style={styles.totalsLabel}>Approx. monthly</Text>
                      <Text style={styles.totalsValue}>{formatMoney(entry.total, entry.currency)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.quickActions}>
                <Button
                  label="Add subscription"
                  onPress={() => router.push(`/instances/${instanceId}/subscriptions/new`)}
                />
                <Button
                  label="Timeline"
                  variant="secondary"
                  onPress={() => router.push(`/instances/${instanceId}/timeline`)}
                />
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No subscriptions yet"
              message="Track a recurring payment to see it here. Your dashboard will show upcoming payments and totals."
              action={
                <Button
                  label="Add subscription"
                  size="lg"
                  onPress={() => router.push(`/instances/${instanceId}/subscriptions/new`)}
                />
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function monthlyEquivalent(sub: Subscription) {
  const amount = Number(sub.amount);
  if (!isFinite(amount)) return 0;
  const count = sub.billingIntervalCount || 1;
  switch (sub.billingInterval) {
    case 'DAILY':
      return (amount * 30) / count;
    case 'WEEKLY':
      return (amount * 52) / 12 / count;
    case 'MONTHLY':
      return amount / count;
    case 'YEARLY':
      return amount / 12 / count;
  }
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  listContentEmpty: { flexGrow: 1 },
  totalsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  totalsCard: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalsLabel: { ...typography.caption, marginBottom: spacing.xs },
  totalsValue: { ...typography.heading },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  subCard: { padding: spacing.lg },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  subTitle: { ...typography.heading },
  subCategory: { ...typography.caption, marginTop: 2 },
  subAmountWrap: { alignItems: 'flex-end' },
  subAmount: { ...typography.bodyMedium, fontSize: 17, color: colors.text },
  subInterval: { ...typography.caption, marginTop: 2 },
  subFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subNext: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  subNextDate: { ...typography.caption },
  subActions: { flexDirection: 'row', gap: spacing.sm },
});
