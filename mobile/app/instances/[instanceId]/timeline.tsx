import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTimeline } from '@/lib/api';
import { formatDate, formatDaysUntil, formatMoney } from '@/lib/format';
import { getInstance } from '@/lib/instances';
import type { SubTrackInstance, TimelinePayment } from '@/lib/types';
import {
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Pill,
  ScreenHeader,
  Segmented,
} from '@/ui/components';
import { colors, radii, spacing, typography } from '@/ui/theme';

type MonthsRange = '3' | '6' | '12' | '24';

const rangeOptions: { value: MonthsRange; label: string }[] = [
  { value: '3', label: '3 mo' },
  { value: '6', label: '6 mo' },
  { value: '12', label: '12 mo' },
  { value: '24', label: '24 mo' },
];

type Status = 'loading' | 'ready' | 'error';

export default function TimelinePage() {
  const router = useRouter();
  const { instanceId } = useLocalSearchParams<{ instanceId: string }>();
  const [instance, setInstance] = useState<SubTrackInstance | null>(null);
  const [payments, setPayments] = useState<TimelinePayment[]>([]);
  const [months, setMonths] = useState<MonthsRange>('12');
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh', monthsValue: MonthsRange) => {
      if (!instanceId) return;
      if (mode === 'initial') setStatus('loading');
      if (mode === 'refresh') setRefreshing(true);
      try {
        const loadedInstance = instance ?? (await getInstance(instanceId));
        if (!loadedInstance) throw new Error('Instance not found on this device.');
        if (!instance) setInstance(loadedInstance);
        const { payments: list } = await getTimeline(loadedInstance, Number(monthsValue));
        setPayments(list);
        setStatus('ready');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timeline');
        setStatus('error');
      } finally {
        setRefreshing(false);
      }
    },
    [instanceId, instance],
  );

  useFocusEffect(
    useCallback(() => {
      load('initial', months);
    }, [load, months]),
  );

  const grouped = useMemo(() => groupByMonth(payments), [payments]);
  const totals = useMemo(() => summarizeByCurrency(payments), [payments]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title="Upcoming payments"
        subtitle={instance?.name}
        onBack={() => router.push(`/instances/${instanceId}`)}
        backLabel="Back"
      />
      {status === 'loading' ? (
        <LoadingState label="Loading timeline" />
      ) : status === 'error' ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={() => load('initial', months)} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh', months)}
              tintColor={colors.primary}
            />
          }
        >
          <Segmented<MonthsRange>
            label="Time range"
            value={months}
            options={rangeOptions}
            onChange={setMonths}
          />

          {totals.length > 0 ? (
            <View style={styles.totalsRow}>
              {totals.map((entry) => (
                <View key={entry.currency} style={styles.totalsCard}>
                  <Text style={styles.totalsLabel}>Total · next {months} mo</Text>
                  <Text style={styles.totalsValue}>{formatMoney(entry.total, entry.currency)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {grouped.length === 0 ? (
            <EmptyState
              title="No upcoming payments"
              message={`No subscriptions are scheduled to bill in the next ${months} months.`}
            />
          ) : (
            grouped.map((group) => (
              <View key={group.key} style={styles.monthGroup}>
                <View style={styles.monthHeader}>
                  <Text style={styles.monthTitle}>{group.title}</Text>
                  <Text style={styles.monthCount}>
                    {group.items.length} payment{group.items.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Card style={{ padding: 0 }}>
                  {group.items.map((payment, index) => {
                    const isLast = index === group.items.length - 1;
                    const tone: 'danger' | 'warning' | 'primary' | 'neutral' =
                      payment.daysUntil < 0
                        ? 'danger'
                        : payment.daysUntil <= 3
                          ? 'warning'
                          : payment.daysUntil <= 14
                            ? 'primary'
                            : 'neutral';
                    return (
                      <View
                        key={`${payment.subscription.id}-${payment.paymentDate}-${index}`}
                        style={[styles.row, !isLast && styles.rowDivider]}
                      >
                        <View style={styles.rowDate}>
                          <Text style={styles.rowDay}>{getDay(payment.paymentDate)}</Text>
                          <Text style={styles.rowMonth}>{getMonthAbbr(payment.paymentDate)}</Text>
                        </View>
                        <View style={styles.rowMeta}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {payment.subscription.name}
                          </Text>
                          <Text style={styles.rowSubtitle} numberOfLines={1}>
                            {formatDate(payment.paymentDate)}
                          </Text>
                          <Pill
                            label={formatDaysUntil(payment.daysUntil)}
                            tone={tone}
                            style={{ marginTop: spacing.xs }}
                          />
                        </View>
                        <Text style={styles.rowAmount}>
                          {formatMoney(payment.amount, payment.currency)}
                        </Text>
                      </View>
                    );
                  })}
                </Card>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function groupByMonth(payments: TimelinePayment[]) {
  const map = new Map<string, { key: string; title: string; items: TimelinePayment[] }>();
  for (const payment of payments) {
    const date = new Date(payment.paymentDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const title = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long' }).format(date);
    const bucket = map.get(key) ?? { key, title, items: [] };
    bucket.items.push(payment);
    map.set(key, bucket);
  }
  return Array.from(map.values()).map((bucket) => ({
    ...bucket,
    items: bucket.items.sort(
      (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime(),
    ),
  })).sort((a, b) => a.key.localeCompare(b.key));
}

function summarizeByCurrency(payments: TimelinePayment[]) {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const amount = Number(payment.amount);
    if (!Number.isFinite(amount)) continue;
    totals.set(payment.currency, (totals.get(payment.currency) ?? 0) + amount);
  }
  return Array.from(totals.entries()).map(([currency, total]) => ({ currency, total }));
}

function getDay(date: string) {
  return String(new Date(date).getDate());
}

function getMonthAbbr(date: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(date)).toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  totalsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  totalsCard: {
    flexGrow: 1,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totalsLabel: { ...typography.caption },
  totalsValue: { ...typography.heading, marginTop: spacing.xs },

  monthGroup: { marginTop: spacing.lg },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  monthTitle: { ...typography.heading },
  monthCount: { ...typography.caption },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowDate: {
    width: 48,
    height: 56,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDay: { ...typography.title, color: colors.primary, fontSize: 20 },
  rowMonth: { ...typography.caption, color: colors.primary, fontSize: 11, fontWeight: '700' },
  rowMeta: { flex: 1 },
  rowName: { ...typography.bodyMedium },
  rowSubtitle: { ...typography.caption, marginTop: 2 },
  rowAmount: { ...typography.heading, fontSize: 16 },
});
