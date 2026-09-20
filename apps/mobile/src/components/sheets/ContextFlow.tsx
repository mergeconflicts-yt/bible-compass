import { useState } from 'react';
import { ContextSheet } from './ContextSheet';
import { EntitySheet } from './EntitySheet';
import { TimelineSheet } from './TimelineSheet';
import { MapSheet } from './MapSheet';
import type { PreviewEvent } from '@/content/neh2Preview';

interface ContextFlowProps {
  visible: boolean;
  onClose: () => void;
  onOpenPassage?: (passageKey: string) => void;
}

/**
 * The context navigation flow: context sheet fans out to entity profiles,
 * the timeline and the historical map. One component so every view wires
 * the same flow without prop-drilling each sheet separately.
 */
export function ContextFlow({ visible, onClose, onOpenPassage }: ContextFlowProps) {
  const [entitySlug, setEntitySlug] = useState<string | null>(null);
  const [openEvent, setOpenEvent] = useState<PreviewEvent | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const closeEntity = () => {
    setEntitySlug(null);
    setOpenEvent(null);
  };

  return (
    <>
      <ContextSheet
        visible={visible}
        onClose={onClose}
        onOpenEntity={(slug) => setEntitySlug(slug)}
        onOpenEvent={(event) => setOpenEvent(event)}
        onOpenTimeline={() => {
          onClose();
          setTimelineOpen(true);
        }}
        onOpenMap={() => {
          onClose();
          setMapOpen(true);
        }}
        onOpenPassage={(key) => {
          onClose();
          onOpenPassage?.(key);
        }}
      />
      <EntitySheet
        visible={entitySlug !== null || openEvent !== null}
        slug={entitySlug}
        event={openEvent}
        onClose={closeEntity}
        onOpenEntity={(slug) => setEntitySlug(slug)}
        onOpenPassage={(key) => {
          closeEntity();
          onClose();
          onOpenPassage?.(key);
        }}
        onOpenTimeline={() => {
          closeEntity();
          setTimelineOpen(true);
        }}
        onOpenMap={() => {
          closeEntity();
          setMapOpen(true);
        }}
      />
      <TimelineSheet
        visible={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onOpenPassage={(key) => {
          setTimelineOpen(false);
          onClose();
          onOpenPassage?.(key);
        }}
      />
      <MapSheet visible={mapOpen} onClose={() => setMapOpen(false)} />
    </>
  );
}
