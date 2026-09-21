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
  getPreview,
  previewNotice,
  entityBySlug,
  rolesForEntity,
  type PreviewEntity,
  type PreviewEvent,
  type PreviewRole,
} from '@/content/neh2Preview';
import { getPassageContent } from '@/content/passageStore';

interface EntitySheetProps {
  visible: boolean;
  /** Preview entity slug; unknown slugs render an honest unavailable state. */
  slug: string | null;
  /** Direct event record for event full cards (bypasses slug lookup). */
  event?: PreviewEvent | null;
  onClose: () => void;
  onOpenEntity: (slug: string) => void;
  onOpenPassage: (passageKey: string) => void;
  onOpenTimeline?: () => void;
}

const TYPE_GLYPHS: Record<string, keyof typeof Ionicons.glyphMap> = {
  person: 'person-outline',
  deity: 'sparkles-outline',
  place: 'location-outline',
  structure: 'business-outline',
  collective: 'people-outline',
  polity: 'flag-outline',
  event: 'calendar-outline',
  empire: 'flag-outline',
  role: 'briefcase-outline',
  practice: 'repeat-outline',
  object: 'cube-outline',
};

function slugifyRef(ref: string): string {
  return ref.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/** "IN NEHEMIAH 2" from the passage key; honest fallback when unparseable. */
function passageLabel(translationId: string): string {
  const [bookOsis, chapterRaw] = getPreview().passage.split('.');
  const chapter = Number.parseInt(chapterRaw ?? '', 10);
  if (!bookOsis || !Number.isInteger(chapter)) return 'IN THIS PASSAGE';
  const content = getPassageContent(bookOsis, chapter, translationId);
  if (!content) return 'IN THIS PASSAGE';
  return `IN ${content.bookName.toUpperCase()} ${chapter}`;
}

/** All person entities in the preview are male except the queen; revisit if that changes. */
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
 * only when its data exists. Roles come from the curated relevance records,
 * one "In this passage" card per scope.
 */
export function EntitySheet({
  visible,
  slug,
  event = null,
  onClose,
  onOpenEntity,
  onOpenPassage,
  onOpenTimeline,
}: EntitySheetProps) {
  const { colors } = useTheme();
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';
  const entity = slug ? entityBySlug(slug) : null;
  const roles = slug ? rolesForEntity(slug) : [];
  const connected =
    slug && entity?.type === 'person'
      ? getPreview().entities.filter((person) => person.type === 'person' && person.slug !== slug)
      : [];
  const headerType = event ? 'event' : entity?.type;
  const headerName = entity?.name ?? event?.title ?? '';

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
          This profile has no preview content yet.
        </AppText>
      ) : (
        <FullCard
          entity={entity}
          event={event}
          roles={roles}
          passageLabelText={passageLabel(translationId)}
          connected={connected.map((person) => ({ slug: person.slug, name: person.name }))}
          onOpenEntity={onOpenEntity}
          onOpenPassage={onOpenPassage}
          onOpenTimeline={onOpenTimeline}
          onBack={onClose}
        />
      )}
    </Sheet>
  );
}

export interface FullCardProps {
  entity?: PreviewEntity | null;
  event?: PreviewEvent | null;
  roles?: PreviewRole[];
  passageLabelText?: string;
  connected?: { slug: string; name: string; role?: string }[];
  onOpenEntity?: (slug: string) => void;
  onOpenPassage?: (passageKey: string) => void;
  onOpenTimeline?: () => void;
  onBack?: () => void;
}

interface FactItem {
  key: string;
  lead: string;
  refs?: Array<{ ref: string; passageKey: string }>;
}

/**
 * Presentational full card. Entities resolve by slug in EntitySheet; events
 * render directly. Sections appear only when their data exists.
 */
export function FullCard({
  entity = null,
  event = null,
  roles = [],
  passageLabelText = 'IN THIS PASSAGE',
  connected = [],
  onOpenEntity,
  onOpenPassage,
  onOpenTimeline,
  onBack,
}: FullCardProps) {
  const { colors } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  if (!entity && !event) return null;

  const type = event ? 'event' : (entity?.type ?? 'object');
  const standing = entity?.short_description ?? null;
  const prose = entity
    ? `${entity.short_description} ${entity.extended_description ?? ''}`.trim()
    : null;
  const profileHeading =
    type === 'person' && entity ? `About ${pronoun(entity.slug, true)}` : `About the ${type}`;

  const facts: FactItem[] = [];
  if (entity) {
    if (entity.aliases.length > 0) {
      facts.push({ key: 'aliases', lead: `Also known as ${entity.aliases.join(', ')}` });
    }
    if (entity.appearances.length > 0) {
      facts.push({
        key: 'appearances',
        lead: `Named in ${entity.appearances.length} ${entity.appearances.length === 1 ? 'passage' : 'passages'}`,
        refs: entity.appearances,
      });
    }
  }
  const shownFacts = facts.slice(0, 3);

  let lateral: { title: string; onPress: () => void } | null = null;
  if (onOpenTimeline && (type === 'person' || type === 'event' || type === 'empire')) {
    lateral = {
      title:
        type === 'person' && entity ? `See ${pronoun(entity.slug, true)} in time` : 'See in time',
      onPress: onOpenTimeline,
    };
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

      {event ? (
        <View style={[styles.spineCard, { backgroundColor: colors.surfaceSubtle }]}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            IN NEHEMIAH 2 · {event.range}
          </AppText>
          {event.participants.length > 0 ? (
            <AppText variant="body" scripture style={styles.sectionBody}>
              {`With ${event.participants.map((person) => person.name).join(', ')}`}
            </AppText>
          ) : null}
          {event.places.length > 0 ? (
            <AppText variant="body" scripture style={styles.sectionBody}>
              {`At ${event.places.map((place) => place.name).join(', ')}`}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {roles.length > 0 ? (
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
          {roles.map((role) => (
            <View key={role.scope_key}>
              <AppText variant="caption" color="textSecondary" style={styles.sectionBody}>
                {role.scope_title}
              </AppText>
              <ReferenceText
                text={role.role_text}
                onOpenPassage={onOpenPassage}
                variant="body"
                scripture
                style={styles.sectionBody}
              />
            </View>
          ))}
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
              {previewNotice()}
            </AppText>
            <AppText variant="metadata" color="textSecondary" style={styles.srcText}>
              • Curated draft packages: canonical, English locale and BSB edition (see evidence
              catalog).
            </AppText>
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
