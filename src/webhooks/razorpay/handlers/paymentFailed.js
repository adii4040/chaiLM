/**
 * Handles 'payment.failed' webhook event.
 * Fired when an individual payment transaction fails.
 *
 * @param {object} payload - Razorpay webhook payload
 * @returns {Promise<object>} Result summary
 */
export async function handlePaymentFailed(payload) {
  const paymentEntity = payload?.payment?.entity;
  console.warn(`[Webhook:payment.failed] Payment ID: ${paymentEntity?.id}, Amount: ${paymentEntity?.amount}, Error Code: ${paymentEntity?.error_code}, Description: ${paymentEntity?.error_description}`);

  return {
    paymentId: paymentEntity?.id,
    errorCode: paymentEntity?.error_code,
    description: paymentEntity?.error_description,
  };
}
