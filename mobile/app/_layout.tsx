import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F5F6FA' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="instances/new" />
        <Stack.Screen name="instances/[instanceId]/index" />
        <Stack.Screen name="instances/[instanceId]/subscriptions/new" />
        <Stack.Screen name="instances/[instanceId]/subscriptions/[subscriptionId]/index" />
        <Stack.Screen name="instances/[instanceId]/subscriptions/[subscriptionId]/edit" />
        <Stack.Screen name="instances/[instanceId]/timeline" />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
