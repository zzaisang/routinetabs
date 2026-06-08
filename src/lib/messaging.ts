// Thin typed wrapper around chrome.runtime.sendMessage to the service worker.

type Message =
  | { type: 'reschedule'; routineId: string }
  | { type: 'clear'; routineId: string }
  | { type: 'rehydrateAll' }
  | { type: 'runNow'; routineId: string };

interface Ack {
  ok: boolean;
  error?: string;
}

export async function sendToBackground(msg: Message): Promise<Ack> {
  try {
    const res = (await chrome.runtime.sendMessage(msg)) as Ack | undefined;
    return res ?? { ok: false, error: 'no response' };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export const reschedule = (routineId: string) =>
  sendToBackground({ type: 'reschedule', routineId });
export const clearAlarm = (routineId: string) =>
  sendToBackground({ type: 'clear', routineId });
export const rehydrateAll = () => sendToBackground({ type: 'rehydrateAll' });
export const runNow = (routineId: string) =>
  sendToBackground({ type: 'runNow', routineId });
