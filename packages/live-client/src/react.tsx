import type { LiveFrame } from '@ft/contracts';
import { createContext, use, useEffect, useSyncExternalStore, type ReactNode } from 'react';

import type { ConnectionStatus } from './connection.ts';
import type { LiveStore } from './live-store.ts';

const LiveStoreContext = createContext<LiveStore | null>(null);

/** Provides a store to the tree and keeps it connected while mounted. */
export function LiveStoreProvider({ store, children }: { store: LiveStore; children: ReactNode }) {
  useEffect(() => {
    store.connect();
    return () => {
      store.disconnect();
    };
  }, [store]);

  return <LiveStoreContext value={store}>{children}</LiveStoreContext>;
}

export function useLiveStore(): LiveStore {
  const store = use(LiveStoreContext);
  if (!store) {
    throw new Error('useLiveStore must be used inside <LiveStoreProvider>');
  }
  return store;
}

export function useConnectionStatus(): ConnectionStatus {
  const store = useLiveStore();
  return useSyncExternalStore(store.subscribeStatus, store.getStatus, store.getStatus);
}

/**
 * One value derived from the latest frame. The component re-renders only when that value
 * changes, so `select` must return a primitive (or a reference that is stable between frames).
 */
export function useFrameValue<T>(select: (frame: LiveFrame) => T, fallback: T): T {
  const store = useLiveStore();
  const read = (): T => {
    const frame = store.getFrame();
    return frame ? select(frame) : fallback;
  };
  return useSyncExternalStore(store.subscribeFrames, read, () => fallback);
}
