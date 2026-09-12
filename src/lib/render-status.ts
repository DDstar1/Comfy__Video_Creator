// Retry status reads only. Never use this around a render submission.
export async function readRenderStatus(
  read: () => Promise<Response>,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await read();
      if ((response.status < 500 && response.status !== 429) || attempt === 4)
        return response;
    } catch (error) {
      if (attempt === 4) throw error;
    }
    await wait(Math.min(3000 * (attempt + 1), 12000));
  }
  throw new Error("Render status could not be read. Reload to reconnect.");
}
