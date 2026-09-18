/**
 * Auth store (mobile-install-07a).
 *
 * Owns sign-in state: anonymous by default, Apple/Google OAuth when a sync
 * project is configured, SecureStore sessions via the injected provider.
 * Sign-out wipes the on-device library (owner decision D5 — the UI must
 * warn: destructive). Account cloud deletion needs an Edge Function that
 * does not exist yet, so `deleteAccount` wipes locally and reports the
 * cloud wipe as pending (flagged in the M07a handoff as an M07b
 * prerequisite).
 *
 * This module never imports infrastructure, native modules, or network
 * clients. The composition root (`app/_layout.tsx`) injects the
 * Supabase-backed provider when configured; uninitialized, the store stays
 * anonymous and sign-in throws `unconfigured`. Tests inject fakes.
 */

export type AuthProviderId = 'apple' | 'google';

export type AuthStatus = 'anonymous' | 'signing-in' | 'signed-in' | 'error';

export interface AuthState {
  status: AuthStatus;
  userId: string | null;
  provider: AuthProviderId | null;
  message: string | null;
}

export type AuthErrorCode = 'unconfigured' | 'cancelled' | 'network' | 'unknown';

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

export interface AuthSession {
  userId: string;
  provider: AuthProviderId;
}

/** Feature-boundary contract; the Supabase adapter implements it. */
export interface AuthProvider {
  /** Restored session, or null when signed out. */
  getSession(): Promise<AuthSession | null>;
  /** Interactive OAuth; throws AuthError (cancelled when dismissed). */
  signIn(provider: AuthProviderId): Promise<AuthSession>;
  /** Best-effort cloud sign-out; local state is wiped regardless. */
  signOut(): Promise<void>;
}

export interface AuthStoreDeps {
  createAuth: () => AuthProvider;
  /** Deletes bookmarks, outbox, recents, progress. Scripture cache stays. */
  wipeLibrary: () => Promise<void>;
}

const ANONYMOUS: AuthState = {
  status: 'anonymous',
  userId: null,
  provider: null,
  message: null,
};

let deps: AuthStoreDeps | null = null;
let state: AuthState = ANONYMOUS;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** React subscription for screens; the store itself stays UI-free. */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthSnapshot(): AuthState {
  return state;
}

export function initializeAuthStore(next: AuthStoreDeps): void {
  deps = next;
}

/**
 * True once a provider is installed. The composition root installs one only
 * when a sync project is configured, so screens can treat this as the
 * "sync available" flag without reading env themselves (keeps config out of
 * render paths and tests on the store-seeding pattern).
 */
export function isAuthReady(): boolean {
  return deps !== null;
}

export function resetAuthStore(): void {
  deps = null;
  state = ANONYMOUS;
  emit();
}

/** Restores a persisted session; any failure stays anonymous silently. */
export async function restoreSession(): Promise<void> {
  if (!deps) return;
  try {
    const session = await deps.createAuth().getSession();
    state =
      session === null
        ? ANONYMOUS
        : {
            status: 'signed-in',
            userId: session.userId,
            provider: session.provider,
            message: null,
          };
  } catch {
    // Unreadable session (e.g. revoked, corrupt store): stay anonymous.
    state = ANONYMOUS;
  }
  emit();
}

/**
 * Interactive sign-in. Dismissal returns to anonymous without an error
 * state; other failures surface one with retry. Throws `unconfigured` when
 * no sync project is configured.
 */
export async function signInWith(provider: AuthProviderId): Promise<void> {
  if (!deps) {
    throw new AuthError('unconfigured', 'Sync is not configured in this build.');
  }
  state = { status: 'signing-in', userId: null, provider: null, message: null };
  emit();
  try {
    const session = await deps.createAuth().signIn(provider);
    state = {
      status: 'signed-in',
      userId: session.userId,
      provider: session.provider,
      message: null,
    };
  } catch (error) {
    if (error instanceof AuthError && error.code === 'cancelled') {
      state = ANONYMOUS;
    } else {
      state = {
        status: 'error',
        userId: null,
        provider: null,
        message:
          error instanceof AuthError ? error.message : 'Sign-in failed. Try again in a moment.',
      };
    }
  }
  emit();
}

/**
 * Signs out and wipes the on-device library (D5: destructive by owner
 * decision — the UI confirms first). The local wipe runs even when cloud
 * sign-out fails; a failed wipe surfaces an error state for retry.
 */
export async function signOut(): Promise<void> {
  if (!deps) {
    state = ANONYMOUS;
    emit();
    return;
  }
  try {
    await deps.createAuth().signOut();
  } catch {
    // Cloud sign-out failed (e.g. offline): the server session expires on
    // its own; the local wipe below still runs so the device is clean.
  }
  try {
    await deps.wipeLibrary();
    state = ANONYMOUS;
  } catch {
    state = {
      status: 'error',
      userId: state.userId,
      provider: state.provider,
      message: 'Sign-out did not finish — your library may remain. Try again.',
    };
  }
  emit();
}

export interface DeleteAccountResult {
  /** Cloud wipe needs an Edge Function (not built); always pending for now. */
  cloudPending: boolean;
}

/**
 * Deletes the account: local wipe now, cloud wipe pending server support.
 * The UI must say both parts plainly.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  await signOut();
  return { cloudPending: true };
}
