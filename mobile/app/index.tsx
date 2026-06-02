import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteInstance, getInstances } from '@/lib/instances';
import type { SubTrackInstance } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  ScreenHeader,
} from '@/ui/components';
import { colors, radii, spacing, typography } from '@/ui/theme';

export default function InstancesPage() {
  const router = useRouter();
  const [instances, setInstances] = useState<SubTrackInstance[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setStatus('loading');
    if (mode === 'refresh') setRefreshing(true);
    try {
      const list = await getInstances();
      setInstances(list);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load instances');
      setStatus('error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load('initial');
    }, [load]),
  );

  const confirmDelete = useCallback(
    (instance: SubTrackInstance) => {
      Alert.alert(
        'Remove instance',
        `Remove "${instance.name}" from this device? Your SubTrack data will remain on the server.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(instance.id);
              try {
                await deleteInstance(instance.id);
                setInstances((prev) => prev.filter((item) => item.id !== instance.id));
              } catch (err) {
                Alert.alert('Failed to remove', err instanceof Error ? err.message : 'Unknown error');
              } finally {
                setDeletingId(null);
              }
            },
          },
        ],
      );
    },
    [],
  );

  const renderItem = ({ item }: { item: SubTrackInstance }) => (
    <Card
      style={styles.itemCard}
      onPress={() => router.push(`/instances/${item.id}`)}
      accessibilityLabel={`Open ${item.name}`}
    >
      <View style={styles.itemHeader}>
        <View style={styles.itemAvatar}>
          <Text style={styles.itemAvatarText}>{getInitial(item.name)}</Text>
        </View>
        <View style={styles.itemMeta}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.itemUrl} numberOfLines={1}>
            {item.baseUrl}
          </Text>
        </View>
      </View>
      <View style={styles.itemActions}>
        <Button
          label="Open"
          size="sm"
          onPress={() => router.push(`/instances/${item.id}`)}
        />
        <Button
          label={deletingId === item.id ? 'Removing…' : 'Remove'}
          size="sm"
          variant="dangerGhost"
          loading={deletingId === item.id}
          onPress={() => confirmDelete(item)}
        />
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScreenHeader
        title="Your instances"
        subtitle="Connect to a SubTrack server to manage and view your subscriptions on the go."
      />
      {status === 'loading' ? (
        <LoadingState label="Loading your instances" />
      ) : status === 'error' ? (
        <ErrorState message={error ?? 'Unknown error'} onRetry={() => load('initial')} />
      ) : (
        <FlatList
          data={instances}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, instances.length === 0 && styles.listContentEmpty]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={
            <EmptyState
              title="No instances yet"
              message="Add your first SubTrack instance to start syncing subscriptions to this device."
              action={
                <Button
                  label="Add instance"
                  onPress={() => router.push('/instances/new')}
                  size="lg"
                />
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load('refresh')}
              tintColor={colors.primary}
            />
          }
        />
      )}
      {status === 'ready' && instances.length > 0 ? (
        <View style={styles.fabWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add instance"
            onPress={() => router.push('/instances/new')}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabLabel}>Add instance</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function getInitial(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl * 2,
  },
  listContentEmpty: { flexGrow: 1, justifyContent: 'flex-start' },
  itemCard: { padding: spacing.lg },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemAvatar: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAvatarText: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  itemMeta: { flex: 1 },
  itemTitle: { ...typography.heading },
  itemUrl: { ...typography.caption, marginTop: 2 },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    justifyContent: 'flex-end',
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
  },
  fabPressed: { backgroundColor: colors.primaryPressed },
  fabIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 20 },
  fabLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
