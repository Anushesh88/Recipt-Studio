import { describe, it, expect, beforeEach, vi } from "vitest";
import { AWAKE_FOR_MS, useServerStatus } from "./serverStatusStore";

describe("server status", () => {
  beforeEach(() => useServerStatus.setState({ waiting: 0, waitingSince: null, lastAnswerAt: null }));

  it("counts requests only while the server may be asleep", () => {
    const status = () => useServerStatus.getState();
    expect(status().sent()).toBe(true); // nothing heard yet
    expect(status().waiting).toBe(1);
    expect(status().waitingSince).not.toBeNull();
    status().answered(true);
    expect([status().waiting, status().waitingSince]).toEqual([0, null]);
    expect(status().sent()).toBe(false); // it just answered: awake
    expect(status().waiting).toBe(0);
  });

  it("assumes the server fell asleep after a quiet spell", () => {
    vi.useFakeTimers();
    useServerStatus.getState().answered(false);
    vi.advanceTimersByTime(AWAKE_FOR_MS + 1);
    expect(useServerStatus.getState().sent()).toBe(true);
    // No reply at all doesn't count as awake
    useServerStatus.getState().failed(true);
    expect(useServerStatus.getState().waiting).toBe(0);
    expect(useServerStatus.getState().sent()).toBe(true);
    vi.useRealTimers();
  });
});
