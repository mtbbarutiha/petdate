/**
 * This process has no HTTP webhook listener.
 * Calling Telegram setWebhook() then exiting the receive loop leaves the bot silent.
 */
export function webhookListenerImplemented(): boolean {
  return false;
}

export function shouldUseLongPolling(webhookUrl?: string | null): boolean {
  if (webhookListenerImplemented()) return !String(webhookUrl || '').trim();
  return true;
}

export function webhookFootgunMessage(webhookUrl?: string | null): string | null {
  const url = String(webhookUrl || '').trim();
  if (!url || webhookListenerImplemented()) return null;
  return 'BOT_WEBHOOK_URL is set but this process has no webhook HTTP listener. Ignoring webhook and using polling.';
}
