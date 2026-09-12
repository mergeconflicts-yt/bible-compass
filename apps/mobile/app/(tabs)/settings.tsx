import { SettingsView } from '@/components/SettingsView';

/**
 * Thin route: settings as a full tab screen. The demo shows settings as a
 * sheet over the tab bar; a sheet-over-tab has no faithful native
 * equivalent, so the same content and order render full-screen.
 */
export default function SettingsScreen() {
  return <SettingsView />;
}
