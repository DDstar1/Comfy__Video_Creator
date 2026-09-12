// Never submit a second GPU job when only its database acknowledgement failed.
export async function recordAcceptedRender(
  save: () => PromiseLike<{ error: unknown }>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  let error: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      ({ error } = await save());
      if (!error) return;
    } catch (reason) {
      error = reason;
    }
    if (attempt < 2) await wait(500 * (attempt + 1));
  }
  throw error;
}
