import { describe, it, expect, beforeAll } from "vitest";
import { queryClient } from "../api/queryClient";

// Unit tests run in Node: give authStore the localStorage it reads on load
beforeAll(() => {
  const items = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
});

describe("authStore", () => {
  it("drops the cached data of the previous account when the token changes", async () => {
    const { useAuthStore } = await import("./authStore");
    useAuthStore.getState().setToken("token-a");
    queryClient.setQueryData(["templates"], [{ name: "A's template" }]);
    queryClient.setQueryData(["account"], { business_name: "Alpha Shop" });

    useAuthStore.getState().setToken(null); // sign out
    expect(queryClient.getQueryData(["templates"])).toBeUndefined();
    expect(queryClient.getQueryData(["account"])).toBeUndefined();

    useAuthStore.getState().setToken("token-b");
    queryClient.setQueryData(["account"], { business_name: "Beta" });
    useAuthStore.getState().setToken("token-b"); // same account: cache kept
    expect(queryClient.getQueryData(["account"])).toEqual({ business_name: "Beta" });
  });
});
