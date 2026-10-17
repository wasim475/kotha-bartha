export function rateLimitDelayMs(retryAfter, now = Date.now()) {
  if (retryAfter === undefined || retryAfter === null || retryAfter === "") return 60 * 1000;
  const seconds = Number(retryAfter);
  const requested = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
  return Math.max(1000, Math.min(5 * 60 * 1000, Number.isFinite(requested) ? requested : 60 * 1000));
}
