/**
 * Supabase auth adapter (mobile-install-07a).
 *
 * The only module allowed to import `@supabase/supabase-js`,
 * `expo-secure-store`, `expo-web-browser`, or `expo-linking` for auth.
 * Screens and components depend on the `content/authStore` port only.
 *
 * Sessions persist in SecureStore through the stock GOTRUE storage
 * interface (PKCE flow). OAuth runs through the system browser
 * (`openAuthSessionAsync`) with an app-scheme redirect; dismissal maps to
 * `cancelled` so the UI returns to anonymous silently. Only the public anon
 * key enters this module — service-role keys must never reach the bundle
 * (docs/SECURITY.md).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  AuthError,
  type AuthProvider,
  type AuthProviderId,
  type AuthSession,
} from '@/content/authStore';

const PROVIDER_KEY = 'bible-compass-auth-provider';

function isProviderId(value: string | null): value is AuthProviderId {
  return value === 'apple' || value === 'google';
}

export function createAppSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      storage: {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      },
    },
  });
}

export class SupabaseAuth implements AuthProvider {
  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) return null;
    const identityProvider = data.session.user.identities?.[0]?.provider ?? null;
    const storedProvider = identityProvider ?? (await SecureStore.getItemAsync(PROVIDER_KEY));
    if (!isProviderId(storedProvider)) return null;
    return { userId: data.session.user.id, provider: storedProvider };
  }

  async signIn(provider: AuthProviderId): Promise<AuthSession> {
    const redirectTo = Linking.createURL('auth/callback');
    let authUrl: string;
    try {
      const { data, error } = await this.client.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        throw new AuthError('network', 'Could not reach the sign-in service. Try again.');
      }
      authUrl = data.url;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError('network', 'Could not reach the sign-in service. Try again.');
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo);
    if (result.type !== 'success') {
      throw new AuthError('cancelled', 'Sign-in was dismissed.');
    }
    let code: string | null = null;
    try {
      code = new URL(result.url).searchParams.get('code');
    } catch {
      code = null;
    }
    if (!code) {
      throw new AuthError('unknown', 'Sign-in did not return a code. Try again.');
    }
    const { data, error } = await this.client.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      throw new AuthError('network', 'Could not finish signing in. Try again.');
    }
    await SecureStore.setItemAsync(PROVIDER_KEY, provider);
    return { userId: data.session.user.id, provider };
  }

  async signOut(): Promise<void> {
    await SecureStore.deleteItemAsync(PROVIDER_KEY);
    await this.client.auth.signOut();
  }
}
