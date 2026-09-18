import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useOptionalPreferences } from '@/theme/ThemeProvider';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { ReferenceText } from '@/components/ReferenceText';
import { Button } from '@/components/Button';
import { EntityChip } from '@/components/EntityChip';
import {
  draftNotice,
  draftPeople,
  entityBySlug,
  formatYear,
  getDraft,
  getTimeline,
  roleBySlug,
  type DraftAppearance,
  type DraftEntity,
  type DraftEvent,
} from '@/content/neh2Draft';
import { getPassageContent } from '@/content/passageStore';

interface EntitySheetProps {
  visible: boolean;
  /** Draft entity slug; unknown slugs render an honest unavailable state. */
  slug: string | null;
  /** Direct event record for event full cards (bypasses slug lookup). */
  event?: DraftEvent | null;
  onClose: () => void;
  onOpenEntity: (slug: string) => void;
  onOpenPassage: (passageKey: string) => void;
  onOpenTimeline?: () => void;
  onOpenMap?: () => void;
}

const TYPE_GLYPHS: Record<string, keyof typeof Ionicons.glyphMap> = {
  person: 'person-outline',
  place: 'location-outline',
  event: 'calendar-outline',
  empire: 'flag-outline',
  role: 'briefcase-outline',
  practice: 'repeat-outline',
  object: 'cube-outline',
};

function slugifyRef(ref: string): string {
  return ref.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** "IN NEHEMIAH 2" from the draft passage key; honest fallback when unparseable. */
function passageLabel(translationId: string): string {
  const [bookOsis, chapterRaw] = getDraft().passage.split('.');
  const chapter = Number.parseInt(chapterRaw ?? '', 10);
  if (!bookOsis || !Number.isInteger(chapter)) return 'IN THIS PASSAGE';
  const content = getPassageContent(bookOsis, chapter, translationId);
  if (!content) return 'IN THIS PASSAGE';
  return `IN ${content.bookName.toUpperCase()} ${chapter}`;
}

/**
 * Distance of an event from the passage scene, derived from draft years —
 * never stated exactly, always qualified with About. Null when undatable.
 */
export function eventDistance(event: DraftEvent, sceneStart: string | null): string | null {
  if (!sceneStart) return null;
  const scene = Number.parseInt(sceneStart, 10);
  const start = Number.parseInt(event.start, 10);
  if (!Number.isInteger(scene) || !Number.isInteger(start)) return null;
  const diff = scene - start;
  if (diff === 0) return 'The scene itself';
  const years = (Math.round(Math.abs(diff) / 10) * 10).toLocaleString('en-US');
  return diff > 0
    ? `About ${years} years before this scene`
    : `About ${years} years after this scene`;
}

function precisionLabel(raw: string): string {
  return raw === 'approximate' ? 'Approximate' : raw;
}

/** All person entities in the current draft are male; revisit if that changes. */
const MALE_SLUGS = new Set([
  'nehemiah-governor',
  'artaxerxes-i',
  'asaph-royal-park',
  'sanballat-the-horonite',
  'tobiah-ammonite',
  'geshem-arabian',
]);

function pronoun(slug: string, object = false): string {
  if (!MALE_SLUGS.has(slug)) return 'they';
  return object ? 'him' : 'he';
}

/**
 * Full entity card — one hierarchy for every type, each section rendered
 * only when its data exists:
 * type mark + date, name + standing line, per-type spine, In this passage,
 * reusable profile, facts, collapsed sources, one lateral move, Back.
 */
export function EntitySheet({
  visible,
  slug,
  event = null,
  onClose,
  onOpenEntity,
  onOpenPassage,
  onOpenTimeline,
  onOpenMap,
}: EntitySheetProps) {
  const { colors } = useTheme();
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const entity = slug ? entityBySlug(slug) : null;
  const role = slug ? roleBySlug(slug) : null;
  const connected =
    slug && entity?.type === 'person' ? draftPeople().filter((person) => person.slug !== slug) : [];
  const sceneStart =
    getTimeline().find((item) => item.relevance.toLowerCase().includes('you are here'))?.start ??
    null;
  const headerType = event ? 'event' : entity?.type;
  const headerName = entity?.canonical_name ?? event?.title ?? '';

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      full
      closeOnly
      headerContent={
        entity || event ? (
          <View style={styles.headerRow}>
            <View style={[styles.headerGlyph, { backgroundColor: colors.accentSoft }]}>
              <Ionicons
                name={headerType ? (TYPE_GLYPHS[headerType] ?? 'layers-outline') : 'layers-outline'}
                size={20}
                color={colors.accent}
              />
            </View>
            <AppText variant="title3" numberOfLines={1} style={styles.headerName}>
              {headerName}
            </AppText>
          </View>
        ) : undefined
      }
      testID="entity-sheet"
    >
      {!entity && !event ? (
        <AppText variant="body" color="textSecondary">
          This profile has no drafted content yet.
        </AppText>
      ) : (
        <FullCard
          entity={entity}
          event={event}
          inPassage={event ? event.relevance : (role?.role_in_passage ?? null)}
          passageLabelText={passageLabel(translationId)}
          sceneStart={sceneStart}
          connected={connected}
          onOpenEntity={onOpenEntity}
          onOpenPassage={onOpenPassage}
          onOpenTimeline={onOpenTimeline}
          onOpenMap={onOpenMap}
          onBack={onClose}
        />
      )}
    </Sheet>
  );
}

export interface FullCardProps {
  entity?: DraftEntity | null;
  event?: DraftEvent | null;
  inPassage?: string | null;
  passageLabelText?: string;
  sceneStart?: string | null;
  connected?: Array<{ slug: string; name: string; role?: string }>;
  onOpenEntity?: (slug: string) => void;
  onOpenPassage?: (passageKey: string) => void;
  onOpenTimeline?: () => void;
  onOpenMap?: () => void;
  onBack?: () => void;
}

interface FactItem {
  key: string;
  lead: string;
  refs?: DraftAppearance[];
}

/**
 * Presentational full card. Entities resolve by slug in EntitySheet; events
 * render directly. Sections appear only when their data exists — practice,
 * object and role cards simply show fewer sections until records exist.
 */
export function FullCard({
  entity = null,
  event = null,
  inPassage = null,
  passageLabelText = 'IN THIS PASSAGE',
  sceneStart = null,
  connected = [],
  onOpenEntity,
  onOpenPassage,
  onOpenTimeline,
  onOpenMap,
  onBack,
}: FullCardProps) {
  const { colors } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!entity && !event) return null;

  const type = event ? 'event' : (entity?.type ?? 'object');
  // Standing lines need editorial one-liners; the draft holds sentences, so
  // events (which have no short description) omit the line entirely.
  const standing = entity?.short_description ?? null;
  const prose = entity
    ? `${entity.short_description} ${entity.extended_description}`
    : (event?.description ?? '');
  const sources = entity?.sources ?? [];
  const profileHeading =
    type === 'person' && entity ? `About ${pronoun(entity.slug, true)}` : `About the ${type}`;

  const facts: FactItem[] = [];
  if (entity) {
    if (entity.aliases.length > 0) {
      facts.push({ key: 'aliases', lead: `Also known as ${entity.aliases.join(', ')}` });
    }
    const appearances = entity.appearances ?? [];
    if (appearances.length > 0) {
      facts.push({
        key: 'appearances',
        lead: `Named in ${appearances.length} ${appearances.length === 1 ? 'passage' : 'passages'}`,
        refs: appearances,
      });
    }
  }
  if (event) {
    facts.push({
      key: 'date',
      lead: `Date: ${formatYear(event.start)}${event.end && event.end !== event.start ? `–${formatYear(event.end)}` : ''}`,
    });
    facts.push({ key: 'dating', lead: `Dating: ${precisionLabel(event.date_precision)}` });
  }
  const shownFacts = facts.slice(0, 3);

  const distance = event ? eventDistance(event, sceneStart) : null;

  let lateral: { title: string; onPress: () => void } | null = null;
  if (onOpenTimeline && (type === 'person' || type === 'event' || type === 'empire')) {
    lateral = {
      title:
        type === 'person' && entity ? `See ${pronoun(entity.slug, true)} in time` : 'See in time',
      onPress: onOpenTimeline,
    };
  } else if (onOpenMap && type === 'place' && entity) {
    lateral = { title: 'See on map', onPress: onOpenMap };
  }

  return (
    <View testID="full-card">
      {standing ? (
        <AppText variant="body" style={styles.standing}>
          {standing}
        </AppText>
      ) : null}

      {type === 'person' && entity && connected.length > 0 ? (
        <View style={[styles.spineCard, { backgroundColor: colors.surfaceSubtle }]}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            {`WHO ${pronoun(entity.slug).toUpperCase()} STANDS BETWEEN`}
          </AppText>
          <View style={styles.spineList}>
            {connected.map((person) => (
              <EntityChip
                key={person.slug}
                slug={person.slug}
                qualifier={person.role ?? null}
                onPress={(pressed) => onOpenEntity?.(pressed)}
                testID={`connected-${person.slug}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {type === 'place' && entity && onOpenMap ? (
        <View style={[styles.spineCard, { backgroundColor: colors.surfaceSubtle }]}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            {`${entity.type.toUpperCase()} · ${entity.temporal_range.label.toUpperCase()}`}
          </AppText>
          <Pressable
            onPress={onOpenMap}
            testID="fullcard-locate"
            accessibilityRole="button"
            accessibilityLabel={`See ${entity.canonical_name} on the historical map`}
            style={styles.locateRow}
          >
            <Ionicons name="location-outline" size={20} color={colors.accent} />
            <AppText variant="label" style={styles.locateText}>
              {`See ${entity.canonical_name} on the historical map`}
            </AppText>
            <AppText variant="body" color="textSecondary">
              ›
            </AppText>
          </Pressable>
        </View>
      ) : null}

      {type === 'event' && event && distance ? (
        <View style={[styles.spineCard, { backgroundColor: colors.surfaceSubtle }]}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            IN TIME
          </AppText>
          <AppText variant="body" scripture style={styles.sectionBody}>
            {distance}
          </AppText>
          <AppText variant="caption" color="textSecondary" style={styles.finePrint}>
            {`Dating: ${precisionLabel(event.date_precision)}`}
          </AppText>
        </View>
      ) : null}

      {inPassage ? (
        <View
          style={[
            styles.contextCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          testID="fullcard-in-passage"
        >
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            {passageLabelText}
          </AppText>
          <ReferenceText
            text={inPassage}
            onOpenPassage={onOpenPassage}
            variant="body"
            scripture
            style={styles.sectionBody}
          />
        </View>
      ) : null}

      {prose ? (
        <View style={styles.section} testID="fullcard-profile">
          <AppText variant="title3" style={styles.profileHead}>
            {profileHeading}
          </AppText>
          <ReferenceText text={prose} onOpenPassage={onOpenPassage} variant="body" scripture />
        </View>
      ) : null}

      {shownFacts.length > 0 ? (
        <View style={styles.section} testID="fullcard-facts">
          {shownFacts.map((fact) => (
            <View key={fact.key} style={styles.factRow}>
              <View style={[styles.factDot, { borderColor: colors.accent }]} />
              <AppText variant="body" style={styles.factText}>
                {fact.lead}
                {fact.refs ? ': ' : null}
                {fact.refs?.map((appearance, index) => (
                  <Fragment key={appearance.ref}>
                    {index > 0 ? <AppText variant="body">, </AppText> : null}
                    {onOpenPassage ? (
                      <AppText
                        variant="body"
                        color="accent"
                        onPress={() => onOpenPassage(appearance.passageKey)}
                        testID={`fullcard-appearance-${slugifyRef(appearance.ref)}`}
                        accessibilityRole="link"
                        accessibilityLabel={`Open ${appearance.ref}`}
                      >
                        {appearance.ref}
                      </AppText>
                    ) : (
                      <AppText variant="body">{appearance.ref}</AppText>
                    )}
                  </Fragment>
                ))}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View
        style={[styles.sourcesBox, { borderColor: colors.border }]}
        testID="fullcard-sources-box"
      >
        <Pressable
          onPress={() => setSourcesOpen((open) => !open)}
          testID="fullcard-sources-toggle"
          accessibilityRole="button"
          accessibilityState={{ expanded: sourcesOpen }}
          accessibilityLabel="Where this comes from"
          style={styles.sourcesToggle}
        >
          <AppText variant="label">Where this comes from</AppText>
          <AppText variant="body" color="textSecondary">
            {sourcesOpen ? '▾' : '›'}
          </AppText>
        </Pressable>
        {sourcesOpen ? (
          <View testID="fullcard-sources">
            <AppText variant="metadata" color="textSecondary" style={styles.srcText}>
              {draftNotice}
            </AppText>
            {sources.map((source) => (
              <AppText key={source} variant="metadata" color="textSecondary" style={styles.srcText}>
                {`• ${source}`}
              </AppText>
            ))}
          </View>
        ) : null}
      </View>

      {lateral ? (
        <View style={styles.action}>
          <Button
            title={lateral.title}
            variant="secondary"
            onPress={lateral.onPress}
            testID="fullcard-lateral"
          />
        </View>
      ) : null}
      {onBack ? (
        <View style={styles.action}>
          <Button title="‹ Back to the passage" onPress={onBack} testID="fullcard-back" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    flex: 1,
  },
  headerGlyph: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerName: {
    flex: 1,
  },
  eyebrow: {
    letterSpacing: 1.5,
  },
  standing: {
    marginTop: space[1],
  },
  spineCard: {
    borderRadius: radius.card,
    padding: space[4],
    marginTop: space[4],
  },
  spineList: {
    gap: space[2],
    marginTop: space[2],
  },
  locateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginTop: space[2],
    minHeight: space[12],
  },
  locateText: {
    flex: 1,
  },
  contextCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    marginTop: space[4],
  },
  section: {
    marginTop: space[4],
  },
  sectionBody: {
    marginTop: space[1],
  },
  finePrint: {
    marginTop: space[2],
  },
  profileHead: {
    marginBottom: space[2],
  },
  factRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[2],
    alignItems: 'flex-start',
  },
  factDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    marginTop: 7,
  },
  factText: {
    flex: 1,
  },
  sourcesBox: {
    borderWidth: 1,
    borderRadius: radius.button,
    paddingHorizontal: space[4],
    paddingVertical: space[1],
    marginTop: space[4],
  },
  sourcesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    minHeight: space[12],
  },
  srcText: {
    marginTop: space[1],
    marginBottom: space[2],
    lineHeight: 20,
  },
  action: {
    marginTop: space[3],
  },
});
