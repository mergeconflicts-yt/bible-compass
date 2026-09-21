import { useState } from 'react';
import { ContextSheet } from './ContextSheet';
import { EntitySheet } from './EntitySheet';
import { TimelineSheet } from './TimelineSheet';
import type { PreviewEvent } from '@/content/neh2Preview';

interface ContextFlowProps {
  visible: boolean;
  onClose: () => void;
  onOpenPassage?: (passageKey: string) => void;
}

/** One entry in the context navigation stack. */
type ContextTarget =
  { kind: 'entity'; slug: string } | { kind: 'event'; event: PreviewEvent } | { kind: 'timeline' };

/**
 * The context navigation flow: the context sheet fans out to entity profiles,
 * events and the timeline, and every opening is pushed onto a stack so Back
 * unwinds one sheet at a time — entity -> previous entity -> context ->
 * reading. Sheets are never stacked blindly: the top of the stack decides
 * which one is visible.
 */
export function ContextFlow({ visible, onClose, onOpenPassage }: ContextFlowProps) {
  const [stack, setStack] = useState<ContextTarget[]>([]);

  const push = (target: ContextTarget) => setStack((current) => [...current, target]);
  const pop = () => setStack((current) => current.slice(0, -1));
  const reset = () => setStack([]);
  // Closing the flow clears the stack so the next open starts fresh.
  const handleClose = () => {
    reset();
    onClose();
  };

  const current = stack[stack.length - 1] ?? null;
  const entityTarget = current?.kind === 'entity' || current?.kind === 'event' ? current : null;

  return (
    <>
      {/* Only ONE sheet is visible at a time. Stacking React Native Modals
          silently fails to present the second one, which looked like a dead
          tap; swapping instead keeps taps working and Back returns here. */}
      <ContextSheet
        visible={visible && stack.length === 0}
        onClose={handleClose}
        onOpenEntity={(slug) => push({ kind: 'entity', slug })}
        onOpenEvent={(event) => push({ kind: 'event', event })}
        onOpenTimeline={() => push({ kind: 'timeline' })}
        onOpenPassage={(key) => {
          reset();
          onClose();
          onOpenPassage?.(key);
        }}
      />
      <EntitySheet
        visible={visible && entityTarget !== null}
        slug={entityTarget?.kind === 'entity' ? entityTarget.slug : null}
        event={entityTarget?.kind === 'event' ? entityTarget.event : null}
        onClose={pop}
        onOpenEntity={(slug) => push({ kind: 'entity', slug })}
        onOpenPassage={(key) => {
          reset();
          onClose();
          onOpenPassage?.(key);
        }}
        onOpenTimeline={() => push({ kind: 'timeline' })}
      />
      <TimelineSheet
        visible={visible && current?.kind === 'timeline'}
        onClose={pop}
        onOpenPassage={(key) => {
          reset();
          onClose();
          onOpenPassage?.(key);
        }}
      />
    </>
  );
}
