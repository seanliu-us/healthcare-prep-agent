"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export interface User {
  name: string;
  role: string;
}

const STORAGE_KEY = "preppilot.user";

/* localStorage-backed external store, read via useSyncExternalStore so it is
   SSR-safe and free of setState-in-effect. */
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Resolves false during SSR + the hydrating render, then true — lets callers
// avoid rendering auth-dependent UI before the client has read the store.
const NOOP_SUBSCRIBE = () => () => {};

export function useAuth() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const ready = useSyncExternalStore(NOOP_SUBSCRIBE, () => true, () => false);

  const user = useMemo<User | null>(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }, [raw]);

  const signIn = useCallback((name: string, role = "Front Desk") => {
    const u: User = { name: name.trim() || "Front Desk", role };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {
      /* ignore */
    }
    notify();
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    notify();
  }, []);

  return { user, ready, signIn, signOut };
}
