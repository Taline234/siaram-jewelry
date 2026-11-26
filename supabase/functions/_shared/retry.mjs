// Google and Zoho are sometimes briefly unavailable (503) or ask us to slow down (429). Such answers are tried again
// after a short pause, so a blip neither stops the copy nor emails the owner. Only requests that are safe to repeat
// are repeated after a 5xx (reading, signing in, rewriting the same cells): creating or deleting something is not,
// as the first attempt may have worked.
const pause = (n) => new Promise((resolve) => { setTimeout(resolve, (globalThis.RETRY_DELAY_MS ?? 2000) * n); });

export async function fetchWithRetry(url, init = {}, { safe = !init.method || init.method === 'GET', attempts = 3 } = {}) {
  for (let n = 1; ; n += 1) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if (!safe || n >= attempts) throw err;
      await pause(n);
      continue;
    }
    const again = res.status === 429 || (safe && res.status >= 500);
    if (!again || n >= attempts) return res;
    await pause(n);
  }
}
