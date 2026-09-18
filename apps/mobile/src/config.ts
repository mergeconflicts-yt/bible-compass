import { z } from 'zod';

/**
 * Typed public app configuration. Only EXPO_PUBLIC_* values may live here.
 * Secrets (service-role keys, push credentials) must never enter this module
 * or the app bundle — see docs/SECURITY.md.
 */
const configSchema = z.object({
  appEnv: z.enum(['development', 'preview', 'production']).default('development'),
  supabaseUrl: z.string().url().optional(),
  supabaseAnonKey: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  const parsed = configSchema.safeParse({
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || undefined,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || undefined,
  });
  if (!parsed.success) {
    return configSchema.parse({});
  }
  return parsed.data;
}

export const config: AppConfig = loadConfig();

/**
 * True only when a sync project is configured. The anon key is public by
 * design (RLS enforces ownership); service-role keys must never enter the
 * bundle — see docs/SECURITY.md. Unconfigured builds stay fully anonymous.
 */
export function isSyncConfigured(): boolean {
  return !!config.supabaseUrl && !!config.supabaseAnonKey;
}
