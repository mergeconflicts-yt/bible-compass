import { z } from 'zod';

/**
 * Typed public app configuration. Only EXPO_PUBLIC_* values may live here.
 * Secrets (service-role keys, push credentials) must never enter this module
 * or the app bundle — see docs/SECURITY.md.
 */
const configSchema = z.object({
  appEnv: z.enum(['development', 'preview', 'production']).default('development'),
});

export type AppConfig = z.infer<typeof configSchema>;

function loadConfig(): AppConfig {
  const parsed = configSchema.safeParse({
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  });
  if (!parsed.success) {
    return configSchema.parse({});
  }
  return parsed.data;
}

export const config: AppConfig = loadConfig();
