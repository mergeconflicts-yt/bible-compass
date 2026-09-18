/**
 * Auth store (mobile-install-07a).
 *
 * State-machine tests against a fake provider (no native modules, no
 * network): anonymous by default, restore, sign-in success/cancel/failure,
 * unconfigured fail-closed, sign-out wipes the library, and account
 * deletion reports the cloud wipe as pending.
 */

import {
  AuthError,
  deleteAccount,
  getAuthSnapshot,
  initializeAuthStore,
  resetAuthStore,
  restoreSession,
  signInWith,
  signOut,
  subscribeAuth,
  type AuthProvider,
  type AuthSession,
} from '../src/content/authStore';

class FakeAuth implements AuthProvider {
  session: AuthSession | null = null;
  signInBehavior: 'ok' | 'cancelled' | 'network' = 'ok';
  signOutCalls = 0;
  failRestore = false;

  async getSession(): Promise<AuthSession | null> {
    if (this.failRestore) throw new Error('session unreadable');
    return this.session;
  }

  async signIn(): Promise<AuthSession> {
    if (this.signInBehavior === 'cancelled') throw new AuthError('cancelled', 'dismissed');
    if (this.signInBehavior === 'network') throw new AuthError('network', 'offline');
    this.session = { userId: 'user-1', provider: 'apple' };
    return this.session;
  }

  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    this.session = null;
  }
}

function initStore(fake: FakeAuth, wipe: () => Promise<void> = async () => {}): void {
  initializeAuthStore({ createAuth: () => fake, wipeLibrary: wipe });
}

beforeEach(() => {
  resetAuthStore();
});

afterEach(() => {
  resetAuthStore();
});

describe('auth store', () => {
  it('stays anonymous by default and restores persisted sessions', async () => {
    initStore(new FakeAuth());
    expect(getAuthSnapshot().status).toBe('anonymous');
    await restoreSession();
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('restores a persisted session to signed-in', async () => {
    const fake = new FakeAuth();
    fake.session = { userId: 'user-9', provider: 'google' };
    initStore(fake);
    await restoreSession();
    expect(getAuthSnapshot()).toMatchObject({
      status: 'signed-in',
      userId: 'user-9',
      provider: 'google',
    });
  });

  it('stays anonymous when restore fails', async () => {
    const fake = new FakeAuth();
    fake.failRestore = true;
    initStore(fake);
    await restoreSession();
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('signs in and notifies subscribers', async () => {
    initStore(new FakeAuth());
    const seen: string[] = [];
    const stop = subscribeAuth(() => {
      seen.push(getAuthSnapshot().status);
    });
    await signInWith('apple');
    expect(getAuthSnapshot()).toMatchObject({
      status: 'signed-in',
      userId: 'user-1',
      provider: 'apple',
    });
    expect(seen).toEqual(['signing-in', 'signed-in']);
    stop();
  });

  it('returns to anonymous without error when dismissed', async () => {
    const fake = new FakeAuth();
    fake.signInBehavior = 'cancelled';
    initStore(fake);
    await signInWith('google');
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('surfaces an error state with retry when sign-in fails', async () => {
    const fake = new FakeAuth();
    fake.signInBehavior = 'network';
    initStore(fake);
    await signInWith('apple');
    expect(getAuthSnapshot()).toMatchObject({ status: 'error', message: 'offline' });
    fake.signInBehavior = 'ok';
    await signInWith('apple');
    expect(getAuthSnapshot().status).toBe('signed-in');
  });

  it('throws unconfigured when no sync project is initialized', async () => {
    await expect(signInWith('apple')).rejects.toMatchObject({ code: 'unconfigured' });
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('signs out and wipes the on-device library', async () => {
    const fake = new FakeAuth();
    fake.session = { userId: 'user-1', provider: 'apple' };
    const wipe = jest.fn(async () => {});
    initStore(fake, wipe);
    await restoreSession();
    expect(getAuthSnapshot().status).toBe('signed-in');
    await signOut();
    expect(fake.signOutCalls).toBe(1);
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('still wipes locally when cloud sign-out fails', async () => {
    const fake = new FakeAuth();
    fake.session = { userId: 'user-1', provider: 'apple' };
    const wipe = jest.fn(async () => {});
    initStore(fake, wipe);
    await restoreSession();
    jest.spyOn(fake, 'signOut').mockRejectedValueOnce(new Error('offline'));
    await signOut();
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(getAuthSnapshot().status).toBe('anonymous');
  });

  it('surfaces an error when the library wipe fails', async () => {
    const fake = new FakeAuth();
    fake.session = { userId: 'user-1', provider: 'apple' };
    initStore(fake, async () => {
      throw new Error('disk full');
    });
    await restoreSession();
    await signOut();
    expect(getAuthSnapshot()).toMatchObject({ status: 'error' });
  });

  it('deletes locally and reports the cloud wipe as pending', async () => {
    const fake = new FakeAuth();
    fake.session = { userId: 'user-1', provider: 'google' };
    const wipe = jest.fn(async () => {});
    initStore(fake, wipe);
    await restoreSession();
    await expect(deleteAccount()).resolves.toEqual({ cloudPending: true });
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(getAuthSnapshot().status).toBe('anonymous');
  });
});
