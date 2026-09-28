import { handleSubscriptionCharged } from "./handlers/subscriptionCharged.js";
import { handleSubscriptionActivated } from "./handlers/subscriptionActivated.js";
import { handleSubscriptionHalted } from "./handlers/subscriptionHalted.js";
import { handleSubscriptionCancelled } from "./handlers/subscriptionCancelled.js";
import { handlePaymentFailed } from "./handlers/paymentFailed.js";

/**
 * Registry mapping Razorpay event names to their dedicated handlers.
 */
const EVENT_HANDLERS = {
  // Subscription Charged (Monthly recurring billing success)
  "subscription.charged": handleSubscriptionCharged,

  // Subscription Authenticated / Activated / Updated
  "subscription.authenticated": handleSubscriptionActivated,
  "subscription.activated": handleSubscriptionActivated,
  "subscription.updated": handleSubscriptionActivated,

  // Subscription Pending / Halted (Payment retries & failure)
  "subscription.pending": handleSubscriptionHalted,
  "subscription.halted": handleSubscriptionHalted,

  // Subscription Cancelled / Paused / Resumed / Completed
  "subscription.cancelled": handleSubscriptionCancelled,
  "subscription.paused": handleSubscriptionCancelled,
  "subscription.resumed": handleSubscriptionCancelled,
  "subscription.completed": handleSubscriptionCancelled,

  // Payment Failed
  "payment.failed": handlePaymentFailed,
};

/**
 * Dispatches an incoming Razorpay webhook event to its registered handler.
 *
 * @param {string} event - The event name (e.g. 'subscription.charged')
 * @param {object} payload - The event payload object
 * @returns {Promise<object>} Handler result
 */
export async function dispatchRazorpayWebhookEvent(event, payload) {
  const handler = EVENT_HANDLERS[event];

  if (!handler) {
    console.log(`[Webhook:Razorpay] Unhandled or ignored event type: '${event}'`);
    return { ignored: true, event };
  }

  return await handler(payload);
}
