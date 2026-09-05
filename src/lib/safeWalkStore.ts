"use client";

import { useSyncExternalStore } from "react";
import type { PoliceStationSnapshot, SafeWalkDestinationKind } from "./types";

/**
 * Local persistence for the active Safe Walk.
 *
 * The authoritative deadline lives on the server; this only remembers enough
 * for the device to show its countdown and to prove ownership when standing
 * the walk down. It survives a reload or an accidental tab close, which a
 * component-state-only countdown would not.
 *
 * The trusted contact number is stored here and ONLY here. It is never sent
 * to LOG POSE servers, so the escalation record stays free of personal data.
 */

const WALK_KEY = "logpose.safeWalk.v1";
const CONTACT_KEY = "logpose.trustedContact.v1";

export interface StoredSafeWalk {
  id: string;
  deviceToken: string;
  destinationName: string;
  destinationKind: SafeWalkDestinationKind;
  destinationLat: number;
  destinationLng: number;
  expectedArrivalAt: string;
  police: PoliceStationSnapshot | null;
}

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * `useSyncExternalStore` requires a stable snapshot reference, so the parsed
 * value is cached and only re-parsed when the raw string actually changes.
 */
let cachedRaw: string | null = null;
let cachedWalk: StoredSafeWalk | null = null;

function readRaw(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // A full or blocked localStorage must not break the walk itself; the
    // server-side deadline is unaffected either way.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function getWalkSnapshot(): StoredSafeWalk | null {
  const raw = readRaw(WALK_KEY);
  if (raw === cachedRaw) return cachedWalk;

  cachedRaw = raw;
  if (!raw) {
    cachedWalk = null;
    return null;
  }

  try {
    cachedWalk = JSON.parse(raw) as StoredSafeWalk;
  } catch {
    cachedWalk = null;
  }
  return cachedWalk;
}

/** The server renders no walk, so hydration always starts from "none". */
function getServerWalkSnapshot(): StoredSafeWalk | null {
  return null;
}

export function useStoredSafeWalk(): StoredSafeWalk | null {
  return useSyncExternalStore(subscribe, getWalkSnapshot, getServerWalkSnapshot);
}

export function saveSafeWalk(walk: StoredSafeWalk) {
  writeRaw(WALK_KEY, JSON.stringify(walk));
}

export function clearSafeWalk() {
  writeRaw(WALK_KEY, null);
}

function getContactSnapshot(): string {
  return readRaw(CONTACT_KEY) ?? "";
}

function getServerContactSnapshot(): string {
  return "";
}

export function useTrustedContact(): string {
  return useSyncExternalStore(
    subscribe,
    getContactSnapshot,
    getServerContactSnapshot,
  );
}

export function saveTrustedContact(phone: string) {
  const trimmed = phone.trim();
  writeRaw(CONTACT_KEY, trimmed.length > 0 ? trimmed : null);
}
