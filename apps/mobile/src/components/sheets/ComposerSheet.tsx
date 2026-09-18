import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import {
  composerFormats,
  composerThemes,
  dailyVerseReferenceFor,
  dailyVerseTextFor,
} from '@/fixtures/demo';
import { useOptionalPreferences } from '@/theme/ThemeProvider';
import { canShare } from '@/content/translationRights';

interface ComposerSheetProps {
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
}

/**
 * Verse card composer — demo #s-composer. Format and theme selectors are
 * visual state; the mini preview mirrors the artwork card. Download stays
 * disabled until translation image rights are confirmed (fail closed);
 * Share uses the native sheet and follows the same rights table.
 */
export function ComposerSheet({ visible, onClose, onShare }: ComposerSheetProps) {
  const { colors } = useTheme();
  const [format, setFormat] = useState(2);
  const [theme, setTheme] = useState(0);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const shareAllowed = canShare(translationId);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Verse card"
      title="Share today’s verse"
      testID="composer-sheet"
    >
      <View style={[styles.preview, { backgroundColor: colors.brand }]}>
        <AppText
          variant="body"
          scripture
          style={[styles.previewVerse, { color: colors.textOnBrand }]}
        >
          {dailyVerseTextFor(translationId)}
        </AppText>
        <AppText variant="label" style={{ color: colors.textOnBrand }}>
          {dailyVerseReferenceFor(translationId)}
        </AppText>
        <AppText variant="caption" style={[styles.previewAttr, { color: colors.textOnBrand }]}>
          {preferences?.translation.attribution ?? 'Berean Standard Bible · BSB'}
        </AppText>
      </View>

      <AppText variant="caption" color="accent" style={styles.eyebrow}>
        FORMAT
      </AppText>
      <Segmented
        options={composerFormats}
        selected={format}
        onSelect={setFormat}
        accessibilityLabel="Export format"
        testID="composer-format"
      />
      <AppText variant="caption" color="accent" style={styles.eyebrow}>
        DESIGN
      </AppText>
      <Segmented
        options={composerThemes}
        selected={theme}
        onSelect={setTheme}
        accessibilityLabel="Theme"
        testID="composer-theme"
      />

      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            title="Download"
            variant="secondary"
            disabled
            testID="composer-download"
            accessibilityHint="Image download unlocks once translation rights are confirmed"
          />
        </View>
        <View style={styles.action}>
          <Button
            title="Share"
            disabled={!shareAllowed}
            accessibilityHint={
              shareAllowed ? undefined : 'Sharing unlocks once translation rights are confirmed'
            }
            onPress={() => {
              onClose();
              onShare();
            }}
            testID="composer-share"
          />
        </View>
      </View>
      <AppText variant="caption" color="textSecondary" style={styles.note}>
        {composerFormats[format]} · {composerThemes[theme]} · export rejects text that cannot fit
        legibly.
      </AppText>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: 18,
    padding: space[6],
    maxWidth: 250,
    alignSelf: 'center',
    width: '100%',
  },
  previewVerse: {
    fontSize: 20,
    lineHeight: 28,
  },
  previewAttr: {
    marginTop: space[3],
    fontSize: 11,
    opacity: 0.8,
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginTop: space[4],
  },
  actions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[4],
  },
  action: {
    flex: 1,
  },
  note: {
    textAlign: 'center',
    marginTop: space[3],
  },
});
