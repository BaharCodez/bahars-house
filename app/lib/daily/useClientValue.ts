import { useSyncExternalStore } from "react";

const neverChanges = () => () => {};

/**
 * A value that only the browser can answer. The server snapshot renders
 * first; the client's takes over on hydration without a mismatch.
 */
export function useClientValue<T>(readOnClient: () => T, readOnServer: () => T) {
  return useSyncExternalStore(neverChanges, readOnClient, readOnServer);
}
