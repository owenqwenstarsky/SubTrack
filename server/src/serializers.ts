import type { Subscription } from '@prisma/client';

export function serializeSubscription(subscription: Subscription) {
  return {
    ...subscription,
    amount: subscription.amount.toString(),
  };
}
