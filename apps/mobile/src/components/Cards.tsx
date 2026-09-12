import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import {
  draftPeople,
  entityBySlug,
  formatYear,
  roleBySlug,
  type DraftEvent,
} from '@/content/neh2Draft';

export type CardIcon = 'person' | 'place' | 'time' | 'event' | 'other';

interface InfoCardProps {
  icon: CardIcon;
  monogram?: string;
  eyebrow: string;
  title: string;
  /** Wikipedia-infobox-style fact rows (office, dates, also-known-as…). */
  facts?: Array<{ label: string; value: string }>;
  description: string;
  relevance?: string;
  onKnowMore?: () => void;
  knowMoreLabel?: string;
  compact?: boolean;
  testID?: string;
}

const ICON_NAMES: Record<Exclude<CardIcon, 'person'>, keyof typeof Ionicons.glyphMap> = {
  place: 'location-outline',
  time: 'time-outline',
  event: 'calendar-outline',
  other: 'layers-outline',
};

/**
 * Shared anatomy for every context card: who/what it is (1–2 lines),
 * why it matters here, and a Know-more path to full details.
 */
export function InfoCard({
  icon,
  monogram,
  eyebrow,
  title,
  facts,
  description,
  relevance,
  onKnowMore,
  knowMoreLabel = 'Know more ›',
  compact,
  testID,
}: InfoCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        compact && styles.compactCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      testID={testID}
    >
      <View style={styles.head}>
        <View style={[styles.iconBox, { backgroundColor: colors.accentSoft }]}>
          {icon === 'person' ? (
            <AppText variant="title3" color="accent">
              {monogram ?? title.slice(0, 1)}
            </AppText>
          ) : (
            <Ionicons name={ICON_NAMES[icon]} size={22} color={colors.accent} />
          )}
        </View>
        <View style={styles.headText}>
          <AppText variant="caption" color="accent" style={styles.eyebrow}>
            {eyebrow.toUpperCase()}
          </AppText>
          <AppText variant="label">{title}</AppText>
        </View>
      </View>
      <AppText variant="body" color="textSecondary" style={styles.description} numberOfLines={2}>
        {description}
      </AppText>
      {facts && facts.length > 0 ? (
        <View style={styles.facts} testID={testID ? `${testID}-facts` : undefined}>
          {facts.map((fact) => (
            <View key={fact.label} style={styles.factRow}>
              <AppText variant="caption" color="textSecondary" style={styles.factLabel}>
                {fact.label}
              </AppText>
              <AppText variant="metadata" style={styles.factValue}>
                {fact.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {relevance ? (
        <View style={styles.relevance}>
          <AppText variant="caption" color="accent">
            IN THIS PASSAGE
          </AppText>
          <AppText variant="body" scripture numberOfLines={3}>
            {relevance}
          </AppText>
        </View>
      ) : null}
      {onKnowMore ? (
        <Pressable
          onPress={onKnowMore}
          testID={testID ? `${testID}-know-more` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${knowMoreLabel.replace(/›/g, '').trim()} about ${title}`}
          style={styles.knowMore}
        >
          <AppText variant="label" color="accent">
            {knowMoreLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const TYPE_LABELS: Record<string, string> = {
  person: 'Person',
  place: 'Place',
  empire: 'Empire',
  role: 'Role',
};

function EntityCard({
  slug,
  icon,
  compact,
  onKnowMore,
  testID,
}: {
  slug: string;
  icon: CardIcon;
  compact?: boolean;
  onKnowMore: (slug: string) => void;
  testID?: string;
}) {
  const entity = entityBySlug(slug);
  const role = roleBySlug(slug);
  if (!entity) return null;
  const typeLabel = TYPE_LABELS[entity.type] ?? entity.type;
  const facts = [{ label: 'Period', value: entity.temporal_range.label }];
  if (entity.aliases.length > 0) {
    facts.push({ label: 'Also known as', value: entity.aliases.join(', ') });
  }
  return (
    <InfoCard
      icon={icon}
      monogram={entity.canonical_name.slice(0, 1)}
      eyebrow={`${typeLabel} · ${entity.temporal_range.label}`}
      title={entity.canonical_name}
      facts={facts}
      description={`${entity.short_description} ${entity.extended_description}`}
      relevance={role?.role_in_passage}
      onKnowMore={() => onKnowMore(slug)}
      compact={compact}
      testID={testID ?? `entity-card-${slug}`}
    />
  );
}

/** Person card: banner header, passage relevance, connected people, appearances. */
export function PersonCard({
  slug,
  compact,
  onKnowMore,
  onOpenPerson,
  onOpenPassage,
}: {
  slug: string;
  compact?: boolean;
  onKnowMore: (slug: string) => void;
  onOpenPerson?: (slug: string) => void;
  onOpenPassage?: (passageKey: string) => void;
}) {
  const { colors } = useTheme();
  const entity = entityBySlug(slug);
  const role = roleBySlug(slug);
  if (!entity) return null;
  const openPerson = onOpenPerson ?? onKnowMore;
  const connected = draftPeople()
    .map((person) => person.slug)
    .filter((other) => other !== slug);
  const appearances = entity.appearances ?? [];
  return (
    <View
      style={[
        styles.card,
        compact && styles.compactCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      testID={`entity-card-${slug}`}
    >
      <View
        style={[styles.personBanner, { backgroundColor: colors.brand }]}
        accessibilityRole="image"
        accessibilityLabel={`${entity.canonical_name} illustration (decorative)`}
      >
        <View style={styles.personSkyline} pointerEvents="none">
          <View style={[styles.personSkyBlock, styles.personSky1]} />
          <View style={[styles.personSkyBlock, styles.personSky2]} />
          <View style={[styles.personSkyBlock, styles.personSky3]} />
        </View>
        <View style={styles.personBannerText}>
          <AppText variant="title1" scripture style={[styles.personName, { color: colors.textOnBrand }]}>
            {entity.canonical_name}
          </AppText>
          <AppText
            variant="metadata"
            style={{ color: colors.textOnBrand, opacity: 0.9 }}
            numberOfLines={3}
          >
            {entity.short_description}
          </AppText>
        </View>
        <View style={styles.personBannerBottom}>
          <View style={styles.personMiniFigure} pointerEvents="none">
            <View style={[styles.personMiniHead, { backgroundColor: colors.textOnBrand }]} />
            <View style={[styles.personMiniBody, { backgroundColor: colors.textOnBrand }]} />
          </View>
          <Pressable
            onPress={() => onKnowMore(slug)}
            testID={`entity-card-${slug}-know-more`}
            accessibilityRole="button"
            accessibilityLabel={`Know more about ${entity.canonical_name}`}
            style={[styles.knowMorePill, { borderColor: colors.textOnBrand }]}
          >
            <AppText variant="label" style={{ color: colors.textOnBrand }}>
              Know more
            </AppText>
          </Pressable>
        </View>
      </View>
      {role ? (
        <View style={[styles.personSectionCard, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={styles.personSectionHead}>
            <Ionicons name="bulb-outline" size={18} color={colors.accent} />
            <AppText variant="bodyStrong">Relevance to this passage</AppText>
          </View>
          <AppText variant="body" scripture>
            {role.role_in_passage}
          </AppText>
        </View>
      ) : null}
      {connected.length > 0 ? (
        <View style={[styles.personSectionCard, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={styles.personSectionHead}>
            <Ionicons name="people-outline" size={18} color={colors.accent} />
            <AppText variant="bodyStrong">People connected to him</AppText>
          </View>
          <View style={styles.chips}>
            {connected.map((other) => {
              const peer = entityBySlug(other);
              if (!peer) return null;
              return (
                <Pressable
                  key={other}
                  onPress={() => openPerson(other)}
                  testID={`person-${slug}-connected-${other}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${peer.canonical_name}`}
                  style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <View style={[styles.chipAvatar, { backgroundColor: colors.accentSoft }]}>
                    <AppText variant="caption" color="accent">
                      {peer.canonical_name.slice(0, 1)}
                    </AppText>
                  </View>
                  <AppText variant="label">{peer.canonical_name}</AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {appearances.length > 0 ? (
        <View style={[styles.personSectionCard, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={styles.personSectionHead}>
            <Ionicons name="book-outline" size={18} color={colors.accent} />
            <AppText variant="bodyStrong">Where he appears</AppText>
          </View>
          <View style={styles.appearances}>
            {appearances.map((appearance) =>
              onOpenPassage ? (
                <Pressable
                  key={appearance.ref}
                  onPress={() => onOpenPassage(appearance.passageKey)}
                  testID={`person-${slug}-appearance-${appearance.ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${appearance.ref}`}
                  style={styles.appearance}
                >
                  <AppText variant="label" color="accent">
                    {appearance.ref}
                  </AppText>
                </Pressable>
              ) : (
                <AppText
                  key={appearance.ref}
                  variant="label"
                  color="accent"
                  testID={`person-${slug}-appearance-${appearance.ref.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                  style={styles.appearanceText}
                >
                  {appearance.ref}
                </AppText>
              ),
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** Place card: map-pin visual, profile lines, passage role, Know more. */
export function PlaceCard({
  slug,
  compact,
  onKnowMore,
}: {
  slug: string;
  compact?: boolean;
  onKnowMore: (slug: string) => void;
}) {
  return <EntityCard slug={slug} icon="place" compact={compact} onKnowMore={onKnowMore} />;
}

/** Fallback card for empires, roles, groups and terms. */
export function OtherCard({
  slug,
  compact,
  onKnowMore,
}: {
  slug: string;
  compact?: boolean;
  onKnowMore: (slug: string) => void;
}) {
  return <EntityCard slug={slug} icon="other" compact={compact} onKnowMore={onKnowMore} />;
}

/** Time card: a period/date with its precision label. */
export function TimeCard({
  label,
  precision,
  note,
  onKnowMore,
}: {
  label: string;
  precision: string;
  note: string;
  onKnowMore?: () => void;
}) {
  return (
    <InfoCard
      icon="time"
      eyebrow={`Time · ${precision}`}
      title={label}
      description={note}
      onKnowMore={onKnowMore}
      knowMoreLabel="Open timeline ›"
      testID="time-card"
    />
  );
}

/** Event card: a timeline event with date, details and passage relevance. */
export function EventCard({
  event,
  onKnowMore,
}: {
  event: DraftEvent;
  onKnowMore?: () => void;
}) {
  const precision =
    event.date_precision === 'approximate' ? 'Approximate' : event.date_precision;
  return (
    <InfoCard
      icon="event"
      eyebrow="Event"
      title={event.title}
      facts={[
        { label: 'Date', value: formatYear(event.start) },
        { label: 'Dating', value: precision },
      ]}
      description={event.description}
      relevance={event.relevance}
      onKnowMore={onKnowMore}
      knowMoreLabel="Open timeline ›"
      testID={`event-card-${event.canonical_key}`}
    />
  );
}

const styles = StyleSheet.create({
  personBanner: {
    borderRadius: radius.card,
    overflow: 'hidden',
    padding: space[4],
    minHeight: 172,
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  personSkyline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    flexDirection: 'row',
    alignItems: 'flex-end',
    opacity: 0.14,
  },
  personSkyBlock: {
    backgroundColor: '#FFFFFF',
  },
  personSky1: {
    width: 90,
    height: 56,
    marginLeft: 20,
  },
  personSky2: {
    width: 52,
    height: 80,
    marginLeft: 8,
  },
  personSky3: {
    width: 110,
    height: 44,
    marginLeft: 8,
  },
  personBannerText: {
    width: '100%',
    maxWidth: '100%',
  },
  personBannerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginTop: space[3],
  },
  personMiniFigure: {
    width: 56,
    flexShrink: 0,
  },
  personMiniHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: -10,
    zIndex: 1,
  },
  personMiniBody: {
    width: 56,
    height: 48,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    opacity: 0.9,
  },
  personName: {
    fontSize: 28,
    lineHeight: 34,
  },
  knowMorePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  personSectionCard: {
    borderRadius: radius.card,
    padding: space[4],
    marginTop: space[3],
  },
  personSectionHead: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    marginBottom: space[2],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[2],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: space[1],
    paddingRight: space[3],
    paddingVertical: space[1],
    minHeight: 44,
    justifyContent: 'center',
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearances: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    marginTop: space[1],
  },
  appearance: {
    minHeight: space[12],
    justifyContent: 'center',
    paddingHorizontal: space[1],
  },
  appearanceText: {
    minHeight: space[12],
    textAlignVertical: 'center',
    paddingHorizontal: space[1],
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    marginVertical: space[2],
  },
  compactCard: {
    padding: space[3],
  },
  head: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
  },
  eyebrow: {
    letterSpacing: 1,
    marginBottom: 2,
  },
  description: {
    marginTop: space[2],
    lineHeight: 22,
  },
  facts: {
    marginTop: space[2],
    gap: space[1],
  },
  factRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  factLabel: {
    width: 110,
    flexShrink: 0,
  },
  factValue: {
    flex: 1,
  },
  relevance: {
    marginTop: space[2],
  },
  knowMore: {
    marginTop: space[2],
    alignSelf: 'flex-end',
    minHeight: space[12],
    justifyContent: 'center',
  },
});
