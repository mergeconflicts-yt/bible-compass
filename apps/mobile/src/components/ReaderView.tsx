import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { scriptureSizes, usePreferences } from '@/theme/ThemeProvider';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import {
  PeekCard,
  PEEK_SIDE_MARGIN,
  placementForAnchor,
  type AnchorRect,
} from '@/components/PeekCard';
import { ContextFlow } from '@/components/sheets/ContextFlow';
import { OptionsSheet } from '@/components/sheets/OptionsSheet';
import { EntitySheet } from '@/components/sheets/EntitySheet';
import { MapSheet } from '@/components/sheets/MapSheet';
import { TimelineSheet } from '@/components/sheets/TimelineSheet';
import { TimelineRail } from '@/components/TimelineRail';
import { eraRail } from '@/fixtures/demo';
import { anchorsForVerse, getDraft, splitAnchored } from '@/content/neh2Draft';
import {
  activeTranslation,
  getChapter,
  type ChapterBlock,
} from '@/content/bsb';

export interface ReaderViewProps {
  bookOsis: string;
  chapter: number;
  onBack: () => void;
  onOpenPassage?: (passageKey: string) => void;
}

/**
 * Passage reader — demo #v-reader. Any bundled chapter renders with its
 * headings and verses; only Nehemiah 2 gets the reviewed-context layer
 * (era rail, story, person cards, understand action). Other chapters
 * say so honestly instead of faking context. Sheets are local UI state.
 */
export function ReaderView({ bookOsis, chapter, onBack, onOpenPassage }: ReaderViewProps) {
  const { colors } = useTheme();
  const preferences = usePreferences();
  const [storyOpen, setStoryOpen] = useState(true);
  const [contextOpen, setContextOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [peek, setPeek] = useState<{ slug: string; rect: AnchorRect | null } | null>(null);
  const win = useWindowDimensions();
  const [entitySlug, setEntitySlug] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const content = getChapter(bookOsis, chapter);
  const contextMode = bookOsis === 'Neh' && chapter === 2 && content !== null;
  const title = content ? `${content.bookName} ${chapter}` : `${bookOsis} ${chapter}`;

  /* IMG_4195 measures: ~21sp serif with ~1.68 line-height. */
  const scriptSize = scriptureSizes[preferences.scriptureSizeIndex] ?? scriptureSizes[0];
  const scriptLine = Math.round(scriptSize * 1.68);

  // Every validated anchor opens a lightweight peek first; most taps should
  // end there. Know more goes straight to the full card — no middle layer.
  const handleAnchorPress = (slug: string, rect: AnchorRect | null) => {
    setPeek({ slug, rect });
  };

  const openFullCard = (slug: string) => {
    setPeek(null);
    setEntitySlug(slug);
  };

  const placement = peek ? placementForAnchor(peek.rect, win.width, win.height) : null;

  if (!content) {
    return (
      <Screen
        testID="reader-screen"
        header={<ReaderHeader title={title} onBack={onBack} onOptions={undefined} />}
      >
        <AppText variant="body" color="textSecondary">
          This chapter is not in the bundled build yet.
        </AppText>
      </Screen>
    );
  }

  return (
    <Screen
      testID="reader-screen"
      header={<ReaderHeader title={title} onBack={onBack} onOptions={() => setOptionsOpen(true)} />}
      floatingAction={
        contextMode ? (
          <Pressable
            onPress={() => setContextOpen(true)}
            testID="understand-passage"
            accessibilityRole="button"
            accessibilityLabel="Understand this passage"
            hitSlop={12}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: colors.brand, opacity: pressed ? 0.65 : 0.85 },
            ]}
          >
            <AppText variant="title3" style={{ color: colors.textOnBrand }}>
              ?
            </AppText>
          </Pressable>
        ) : undefined
      }
    >

      <View style={[styles.era, { borderColor: colors.border }]}>
        {contextMode ? (
          <View style={styles.eraRow}>
            <View style={[styles.periodChip, { backgroundColor: colors.accentSoft }]}>
              <AppText variant="caption" color="accent" style={styles.eraSmall}>
                {(eraRail.period.split('·')[0] ?? eraRail.period).trim().toUpperCase()}
              </AppText>
            </View>
            <Pressable
              onPress={() => setTimelineOpen(true)}
              testID="reader-open-timeline"
              accessibilityRole="button"
              accessibilityLabel="Open timeline"
            >
              <AppText variant="caption" style={styles.eraSmall}>
                Open timeline <AppText variant="caption" color="textSecondary" style={styles.eraSmall}>›</AppText>
              </AppText>
            </Pressable>
          </View>
        ) : null}
        <TimelineRail
          activeKey={contextMode ? 'nehemiah-2-request' : null}
          onOpenTimeline={() => setTimelineOpen(true)}
        />
      </View>

      {contextMode ? (
        <Pressable
          onPress={() => setStoryOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: storyOpen }}
          accessibilityLabel="Story so far"
          testID="story-toggle"
          style={[styles.story, { borderColor: colors.accent }]}
        >
          <View style={styles.storyRow}>
            <AppText variant="title3" scripture color="accent">
              Story so far
            </AppText>
            <AppText variant="body" color="textSecondary">
              {storyOpen ? '▾' : '›'}
            </AppText>
          </View>
          {storyOpen ? (
            <AppText variant="body" scripture style={[styles.storyText, { fontSize: 20, lineHeight: 33 }]}>
              {getDraft().immediate_summary}
            </AppText>
          ) : null}
        </Pressable>
      ) : null}

      <View testID="scripture-block" style={styles.scriptureBlock}>
        {content.blocks.map((block, index) => (
          <ChapterBlockView
            key={block.kind === 'verse' ? `v${block.number}` : `h${index}`}
            block={block}
            scriptSize={scriptSize}
            scriptLine={scriptLine}
            anchors={
              block.kind === 'verse' ? anchorsForVerse(bookOsis, chapter, block.number) : []
            }
            onAnchorPress={handleAnchorPress}
          />
        ))}
      </View>
      {!contextMode ? (
        <AppText variant="caption" color="textSecondary" style={styles.protoNote}>
          Scripture only — reviewed context is not ready for this chapter yet.
        </AppText>
      ) : null}

      {contextMode ? (
        <>
          <Modal
            visible={peek !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setPeek(null)}
            testID="peek-overlay"
          >
            <View style={styles.peekWrap}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setPeek(null)}
                testID="peek-dismiss"
                accessibilityRole="button"
                accessibilityLabel="Dismiss preview"
              />
              {peek && placement ? (
                <View
                  testID="peek-bubble"
                  style={[
                    styles.peekBubble,
                    placement.caret === null ? styles.peekBubbleFallback : null,
                    placement.top !== undefined ? { top: placement.top } : null,
                    placement.bottom !== undefined ? { bottom: placement.bottom } : null,
                  ]}
                >
                  {placement.caret === 'top' ? (
                    <View
                      testID="peek-caret"
                      style={[
                        styles.peekCaretTop,
                        {
                          marginLeft: placement.caretLeft,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    />
                  ) : null}
                  <PeekCard slug={peek.slug} onFullCard={openFullCard} />
                  {placement.caret === 'bottom' ? (
                    <View
                      testID="peek-caret"
                      style={[
                        styles.peekCaretBottom,
                        {
                          marginLeft: placement.caretLeft,
                          borderColor: colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </Modal>
          <EntitySheet
            visible={entitySlug !== null}
            slug={entitySlug}
            onClose={() => setEntitySlug(null)}
            onOpenEntity={(slug) => setEntitySlug(slug)}
            onOpenPassage={(key) => {
              setEntitySlug(null);
              onOpenPassage?.(key);
            }}
            onOpenTimeline={() => {
              setEntitySlug(null);
              setTimelineOpen(true);
            }}
            onOpenMap={() => {
              setEntitySlug(null);
              setMapOpen(true);
            }}
          />
          <ContextFlow visible={contextOpen} onClose={() => setContextOpen(false)} />
        </>
      ) : null}
      <TimelineSheet visible={timelineOpen} onClose={() => setTimelineOpen(false)} />
      <MapSheet visible={mapOpen} onClose={() => setMapOpen(false)} />
      <OptionsSheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} />
    </Screen>
  );
}

/** Validated anchor phrase for Nehemiah 2:1 in this translation. */
export const NEH2_ANCHOR_PHRASE = 'King Artaxerxes';

/** Minimal surface for positioning the peek: a node that can report window bounds. */
interface MeasurableNode {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

function ChapterBlockView({
  block,
  scriptSize,
  scriptLine,
  anchors,
  onAnchorPress,
}: {
  block: ChapterBlock;
  scriptSize: number;
  scriptLine: number;
  anchors: Array<{ phrase: string; slug: string }>;
  onAnchorPress: (slug: string, rect: AnchorRect | null) => void;
}) {
  const { colors } = useTheme();
  const anchorNodes = useRef(new Map<string, MeasurableNode>());
  if (block.kind === 'heading') {
    return (
      <AppText variant="title3" scripture style={styles.heading}>
        {block.text}
      </AppText>
    );
  }
  const pressAnchor = (slug: string, key: string) => {
    const node = anchorNodes.current.get(key);
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, width, height) => {
        onAnchorPress(slug, width > 0 && height > 0 ? { x, y, width, height } : null);
      });
    } else {
      onAnchorPress(slug, null);
    }
  };
  const segments = splitAnchored(block.text, anchors);
  return (
    <AppText scripture style={[styles.scripture, { fontSize: scriptSize, lineHeight: scriptLine }]}>
      <AppText variant="verseNumber" color="accent" style={[styles.verseNum, { lineHeight: scriptLine }]}>
        {block.number}{'\u00A0'}
      </AppText>
      {segments.map((segment, index) =>
        segment.slug ? (
          <AppText
            key={index}
            scripture
            ref={(node) => {
              if (node) anchorNodes.current.set(String(index), node);
              else anchorNodes.current.delete(String(index));
            }}
            onPress={() => pressAnchor(segment.slug ?? '', String(index))}
            accessibilityRole="link"
            accessibilityLabel={`${segment.text} — open profile`}
            style={[
              styles.anchor,
              { fontSize: scriptSize, lineHeight: scriptLine, textDecorationColor: colors.accent },
            ]}
          >
            {segment.text}
          </AppText>
        ) : (
          <AppText key={index} scripture style={{ fontSize: scriptSize, lineHeight: scriptLine }}>
            {segment.text}
          </AppText>
        ),
      )}
    </AppText>
  );
}

/** Compact sticky header: plain-text back and options glyphs, one-line title. */
function ReaderHeader({
  title,
  onBack,
  onOptions,
}: {
  title: string;
  onBack: () => void;
  onOptions: (() => void) | undefined;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        testID="reader-back"
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={styles.headerGlyphButton}
      >
        <AppText style={[styles.headerGlyph, { color: colors.textPrimary }]}>‹</AppText>
      </Pressable>
      <AppText variant="label" style={styles.headerTitle} numberOfLines={1}>
        {title}{' '}
        <AppText variant="caption" color="textSecondary">
          {activeTranslation.short}
        </AppText>
      </AppText>
      {onOptions ? (
        <Pressable
          onPress={onOptions}
          testID="reader-options"
          accessibilityRole="button"
          accessibilityLabel="Reading options"
          hitSlop={12}
          style={styles.headerGlyphButton}
        >
          <AppText style={[styles.headerGlyph, { color: colors.textPrimary }]}>···</AppText>
        </Pressable>
      ) : (
        <View style={styles.headerGlyphButton} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[2],
    minHeight: space[12],
  },
  headerGlyphButton: {
    minWidth: space[12],
    minHeight: space[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerGlyph: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  era: {
    borderBottomWidth: 1,
    paddingVertical: space[1],
    marginBottom: space[2],
  },
  eraRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[1],
  },
  periodChip: {
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  eraSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  story: {
    borderLeftWidth: 4,
    paddingLeft: space[3],
    paddingVertical: space[1],
    marginBottom: space[4],
    minHeight: space[11],
    justifyContent: 'center',
  },
  storyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    justifyContent: 'space-between',
  },
  storyText: {
    marginTop: space[2],
  },
  heading: {
    marginTop: space[4],
    marginBottom: space[2],
  },
  scriptureBlock: {
    marginTop: space[3],
  },
  scripture: {
    /* Stable verse block: a full line-height of separation so verses read as
       calm paragraphs, never a cramped run — DESIGN_SPEC §§3.2–3.3. */
    marginBottom: space[6],
  },
  verseNum: {
    /* Superscript number: small size, raised baseline, same line box. */
    fontSize: 12,
    transform: [{ translateY: -7 }],
  },
  anchor: {
    textDecorationLine: 'underline',
  },
  protoNote: {
    marginBottom: space[2],
  },
  peekWrap: {
    flex: 1,
  },
  peekBubble: {
    position: 'absolute',
    left: PEEK_SIDE_MARGIN,
    right: PEEK_SIDE_MARGIN,
  },
  peekBubbleFallback: {
    bottom: space[8],
  },
  peekCaretTop: {
    width: 16,
    height: 16,
    marginBottom: -8,
    transform: [{ rotate: '45deg' }],
    borderTopWidth: 1,
    borderLeftWidth: 1,
  },
  peekCaretBottom: {
    width: 16,
    height: 16,
    marginTop: -8,
    transform: [{ rotate: '45deg' }],
    borderBottomWidth: 1,
    borderRightWidth: 1,
  },
  fab: {
    position: 'absolute',
    right: space[5],
    bottom: space[6],
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
