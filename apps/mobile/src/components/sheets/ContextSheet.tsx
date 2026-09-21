import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Segmented } from '@/components/Segmented';
import { NavRow } from '@/components/NavRow';
import { ReferenceText } from '@/components/ReferenceText';
import { EntityChip, EventChip } from '@/components/EntityChip';
import {
  previewBrief,
  previewConnections,
  previewContexts,
  previewEventsForScope,
  previewNotice,
  previewOtherSlugs,
  previewPeople,
  previewPlaceSlugs,
  toBullets,
  type PreviewEvent,
} from '@/content/neh2Preview';
import { bookNameFor } from '@/content/bsb';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

interface ContextSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenEntity: (slug: string) => void;
  onOpenTimeline: () => void;
  onOpenPassage: (passageKey: string) => void;
  onOpenEvent?: (event: PreviewEvent) => void;
}

const tabs = ['Essential', 'History', 'Connections'] as const;

/**
 * Curated passage context — rendered from the generated Nehemiah 2 preview
 * asset (see previewNotice). One scope picker across all six curated passage
 * scopes, then the 30-second brief with people, history sections with
 * places and events, and cross-passage connections. Nothing here is
 * approved content.
 */
export function ContextSheet({
  visible,
  onClose,
  onOpenEntity,
  onOpenTimeline,
  onOpenPassage,
  onOpenEvent,
}: ContextSheetProps) {
  const { colors } = useTheme();
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const [tab, setTab] = useState(0);
  const scopes = previewContexts();
  const [scopeIndex, setScopeIndex] = useState(0);
  const scope = scopes[scopeIndex] ?? scopes[0]!;
  const brief = previewBrief(scope.slug);
  const [whenFirst] = toBullets(scope.when);
  const scopeEvents = previewEventsForScope(scope.slug);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`${bookNameFor('Neh', translationId)} 2 Context · Preview`}
      full
      testID="context-sheet"
    >
      <Segmented
        options={scopes.map((entry) => entry.title)}
        selected={scopeIndex}
        onSelect={setScopeIndex}
        accessibilityLabel="Passage scopes"
        testID="context-scope"
        compact
      />
      <Segmented
        options={tabs}
        selected={tab}
        onSelect={setTab}
        accessibilityLabel="Context tabs"
        testID="context-tabs"
        compact
      />

      {tab === 0 ? (
        <View testID="context-essential">
          <View style={[styles.brief, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.briefNum, { backgroundColor: colors.accent }]}>
              <AppText variant="title3" style={{ color: colors.textOnBrand }}>
                30
              </AppText>
            </View>
            <View>
              <AppText variant="label">THE 30-SECOND BRIEF</AppText>
              <AppText variant="metadata" color="textSecondary">
                Three things to understand before reading
              </AppText>
            </View>
          </View>
          {brief.map((step, index) => (
            <View key={step.label} style={styles.step}>
              <View style={styles.stepRail}>
                <View
                  style={[
                    styles.stepNum,
                    {
                      borderColor: colors.accent,
                      backgroundColor: step.hot ? colors.accent : colors.canvas,
                    },
                  ]}
                >
                  <AppText variant="caption" color={step.hot ? 'textOnBrand' : 'accent'}>
                    {index + 1}
                  </AppText>
                </View>
                {index === brief.length - 1 ? null : (
                  <View style={[styles.stubLine, { backgroundColor: colors.border }]} />
                )}
              </View>
              <View style={styles.stepText}>
                <AppText variant="caption" color="accent">
                  {step.label}
                </AppText>
                {toBullets(step.text).map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <View style={[styles.bulletDot, { backgroundColor: colors.accent }]} />
                    <ReferenceText
                      text={bullet}
                      onOpenPassage={onOpenPassage}
                      variant="body"
                      scripture
                      style={styles.bulletText}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            PEOPLE IN THIS PASSAGE
          </AppText>
          <View style={styles.chipList}>
            {previewPeople(scope.slug).map((person) => (
              <EntityChip
                key={person.slug}
                slug={person.slug}
                qualifier={person.role}
                onPress={onOpenEntity}
                testID={`context-person-${person.slug}`}
              />
            ))}
          </View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            OTHERS IN THIS PASSAGE
          </AppText>
          <View style={styles.chipList}>
            {previewOtherSlugs(scope.slug).map((slug) => (
              <EntityChip
                key={slug}
                slug={slug}
                onPress={onOpenEntity}
                testID={`context-other-${slug}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {tab === 1 ? (
        <View testID="context-history">
          <View style={styles.chipList}>
            <EventChip
              title={(whenFirst ?? scope.when).trim()}
              qualifier="Approximate"
              onPress={onOpenTimeline}
              testID="context-time-chip"
            />
          </View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            PLACES IN THIS PASSAGE
          </AppText>
          <View style={styles.chipList}>
            {previewPlaceSlugs(scope.slug).map((slug) => (
              <EntityChip
                key={slug}
                slug={slug}
                onPress={onOpenEntity}
                testID={`context-place-${slug}`}
              />
            ))}
          </View>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            EVENTS IN THIS PASSAGE
          </AppText>
          <View style={styles.chipList}>
            {scopeEvents.map((event) => (
              <EventChip
                key={event.key}
                title={event.title}
                qualifier={event.range}
                onPress={() => (onOpenEvent ? onOpenEvent(event) : onOpenTimeline())}
                testID={`context-event-${event.key}`}
              />
            ))}
          </View>
          <View style={styles.historyActions}>
            <Button
              title="Timeline ›"
              variant="secondary"
              onPress={onOpenTimeline}
              testID="context-open-timeline"
            />
          </View>
          <ReviewBox />
        </View>
      ) : null}

      {tab === 2 ? (
        <View testID="context-connections">
          {previewConnections().map((connection) => (
            <NavRow
              key={connection.title}
              title={connection.title}
              meta={connection.note}
              onPress={() => onOpenPassage(connection.passageKey)}
              testID={`connection-${connection.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            />
          ))}
          <ReviewBox />
        </View>
      ) : null}
    </Sheet>
  );
}

export function ReviewBox() {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.review, { backgroundColor: colors.surfaceSubtle }]}
      testID="context-review-box"
    >
      <AppText variant="caption">DRAFT PREVIEW · UNVERIFIED CURATED CONTENT</AppText>
      <AppText variant="metadata" color="textSecondary" style={styles.reviewText}>
        {previewNotice()} Scripture and commentary remain separate.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    letterSpacing: 1.5,
    marginTop: space[4],
    marginBottom: space[2],
  },
  chipList: {
    gap: space[2],
    marginBottom: space[2],
  },
  brief: {
    borderRadius: radius.card,
    padding: space[3],
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
    marginVertical: space[2],
  },
  briefNum: {
    borderRadius: space[2],
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    flexDirection: 'row',
    gap: space[3],
    paddingVertical: space[2],
  },
  stepRail: {
    width: 20,
    alignItems: 'center',
  },
  stubLine: {
    flex: 1,
    width: 2,
    borderRadius: 1,
  },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[1],
    alignItems: 'flex-start',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
  },
  bulletText: {
    flex: 1,
  },
  historyActions: {
    gap: space[2],
    marginVertical: space[3],
  },
  review: {
    borderRadius: radius.button,
    padding: space[4],
    marginTop: space[4],
  },
  reviewText: {
    marginTop: space[1],
    lineHeight: 20,
  },
});
