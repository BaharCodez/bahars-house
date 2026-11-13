import { useSyncExternalStore } from "react";

/* The "select any sentence" line lives in localStorage, not the database:
   it's about this browser having learned the trick, not about the reading.
   A hand-rolled store so useSyncExternalStore can re-render on dismissal. */
const HINT_KEY = "reader-hint-dismissed";
let hintListeners: (() => void)[] = [];

function subscribeHint(onChange: () => void) {
  hintListeners.push(onChange);
  return () => {
    hintListeners = hintListeners.filter((l) => l !== onChange);
  };
}

export function dismissHint() {
  localStorage.setItem(HINT_KEY, "done");
  for (const l of hintListeners) l();
}

/** Whether to show the how-to hint. */
export function useShowHint() {
  // SSR says "dismissed" (there's no localStorage); the real answer arrives
  // on hydration, so the hint never flashes for someone who's put it away.
  return useSyncExternalStore(
    subscribeHint,
    () => localStorage.getItem(HINT_KEY) !== "done",
    () => false,
  );
}
