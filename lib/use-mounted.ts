import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False while rendering on the server and during hydration, true in the browser after. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
