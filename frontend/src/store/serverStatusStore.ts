import { create } from 'zustand';

// Free hosts put the backend to sleep when nobody uses it, and the first
// request then waits about a minute while it starts. This tracks requests made
// while the server may be asleep, so the app can say what's happening.

// A server that answered this recently is awake (Render sleeps after 15 minutes)
export const AWAKE_FOR_MS = 10 * 60 * 1000;

interface ServerStatus {
  waiting: number; // requests sent while the server may be asleep, not answered yet
  waitingSince: number | null; // when the first of them was sent
  lastAnswerAt: number | null;
  sent: () => boolean; // true if this request counts as waiting
  answered: (counted: boolean) => void; // the server replied (even with an error)
  failed: (counted: boolean) => void; // no reply at all (network error)
}

export const useServerStatus = create<ServerStatus>((set, get) => ({
  waiting: 0,
  waitingSince: null,
  lastAnswerAt: null,
  sent: () => {
    const { lastAnswerAt } = get();
    const mayBeAsleep = lastAnswerAt === null || Date.now() - lastAnswerAt > AWAKE_FOR_MS;
    if (mayBeAsleep) set((s) => ({ waiting: s.waiting + 1, waitingSince: s.waitingSince ?? Date.now() }));
    return mayBeAsleep;
  },
  answered: (counted) => set((s) => ({ ...settle(s, counted), lastAnswerAt: Date.now() })),
  failed: (counted) => set((s) => settle(s, counted)),
}));

function settle(s: ServerStatus, counted: boolean): Pick<ServerStatus, "waiting" | "waitingSince"> {
  const waiting = counted ? Math.max(0, s.waiting - 1) : s.waiting;
  return { waiting, waitingSince: waiting === 0 ? null : s.waitingSince };
}
