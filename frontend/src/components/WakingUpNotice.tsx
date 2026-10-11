import React, { useEffect, useState } from "react";
import { useServerStatus } from "../store/serverStatusStore";

// Shown only if the server hasn't answered after this long
const SHOW_AFTER_MS = 3000;

// "Waking up the server": free hosting sleeps when idle, and the first visit
// after that waits about a minute (store/serverStatusStore.ts)
export const WakingUpNotice: React.FC = () => {
  const since = useServerStatus((s) => s.waitingSince);
  // The wait (by its start time) that has gone on long enough to mention
  const [longWait, setLongWait] = useState<number | null>(null);
  useEffect(() => {
    if (since === null) return;
    const timer = setTimeout(() => setLongWait(since), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [since]);
  if (since === null || longWait !== since) return null;
  return (
    <div role="status" data-waking-up="" className="fixed inset-x-0 top-0 z-[100] flex justify-center p-2 print:hidden">
      <p className="flex items-center gap-2 rounded-full bg-indigo-700 px-4 py-2 text-sm text-white shadow-lg">
        <span className="size-2 animate-pulse rounded-full bg-amber-300" aria-hidden="true" />
        Waking up the server… the first visit can take up to a minute.
      </p>
    </div>
  );
};
