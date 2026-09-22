import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { EntityChip, EventChip } from '@/components/EntityChip';
import { ContextSheet } from '@/components/sheets/ContextSheet';
import { ContextFlow } from '@/components/sheets/ContextFlow';
import { previewEvents } from '@/content/neh2Preview';

describe('EntityChip', () => {
  it('shows glyph, name and qualifier, and opens the full card on press', () => {
    const onPress = jest.fn();
    render(<EntityChip slug="artaxerxes-i" qualifier="King of Persia" onPress={onPress} />);
    expect(screen.getByTestId('entity-chip-artaxerxes-i')).toBeTruthy();
    expect(screen.getByText('Artaxerxes I')).toBeTruthy();
    expect(screen.getByText('King of Persia')).toBeTruthy();
    fireEvent.press(screen.getByTestId('entity-chip-artaxerxes-i'));
    expect(onPress).toHaveBeenCalledWith('artaxerxes-i');
  });

  it('falls back to the passage role when no qualifier is passed', () => {
    render(<EntityChip slug="nehemiah-governor" onPress={jest.fn()} />);
    expect(screen.getByText('Nehemiah')).toBeTruthy();
    expect(screen.getByText(/cupbearer whose visible/)).toBeTruthy();
  });

  it('renders nothing for unknown slugs instead of guessing', () => {
    render(<EntityChip slug="no-such-entity" onPress={jest.fn()} />);
    expect(screen.queryByTestId('entity-chip-no-such-entity')).toBeNull();
  });
});

describe('EventChip', () => {
  it('shows title and date qualifier, and navigates on press', () => {
    const request = previewEvents()[0];
    if (!request) throw new Error('expected a preview event');
    const onPress = jest.fn();
    render(
      <EventChip
        title={request.title}
        qualifier={request.range}
        onPress={onPress}
        testID="event-chip-test"
      />,
    );
    expect(screen.getByText('Audience With Artaxerxes')).toBeTruthy();
    expect(screen.getByText('Neh.2.1–Neh.2.8')).toBeTruthy();
    fireEvent.press(screen.getByTestId('event-chip-test'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ContextSheet entity chips', () => {
  const sheetProps = {
    onClose: jest.fn(),
    onOpenEntity: jest.fn(),
    onOpenTimeline: jest.fn(),
    onOpenPassage: jest.fn(),
    onOpenEvent: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());

  it('lists people as chips that open the full card', () => {
    render(<ContextSheet visible {...sheetProps} />);
    expect(screen.getByTestId('context-person-nehemiah-governor')).toBeTruthy();
    expect(screen.getByText('Nehemiah')).toBeTruthy();
    fireEvent.press(screen.getByTestId('context-person-nehemiah-governor'));
    expect(sheetProps.onOpenEntity).toHaveBeenCalledWith('nehemiah-governor');
  });

  it('lists places as chips on the History tab', () => {
    render(<ContextSheet visible {...sheetProps} />);
    fireEvent.press(screen.getByTestId('context-tabs-1'));
    expect(screen.getByTestId('context-place-jerusalem')).toBeTruthy();
    expect(screen.getByText('Jerusalem')).toBeTruthy();
    fireEvent.press(screen.getByTestId('context-place-jerusalem'));
    expect(sheetProps.onOpenEntity).toHaveBeenCalledWith('jerusalem');
  });

  it('shows the when text without navigating, and lists events that open', () => {
    render(<ContextSheet visible {...sheetProps} />);
    fireEvent.press(screen.getByTestId('context-tabs-1'));
    // "Nisan ..." is plain context now, not a control that jumps to the timeline.
    expect(screen.getByTestId('context-when')).toBeTruthy();
    expect(screen.queryByTestId('context-time-chip')).toBeNull();
    expect(sheetProps.onOpenTimeline).not.toHaveBeenCalled();
    expect(screen.getByTestId('context-event-audience-with-artaxerxes')).toBeTruthy();
    fireEvent.press(screen.getByTestId('context-event-audience-with-artaxerxes'));
    expect(sheetProps.onOpenEvent).toHaveBeenCalledTimes(1);
  });

  it('closes the whole flow from the person sheet close control', () => {
    function Flow() {
      const [open, setOpen] = useState(true);
      return <ContextFlow visible={open} onClose={() => setOpen(false)} />;
    }
    render(<Flow />);
    fireEvent.press(screen.getByTestId('context-person-nehemiah-governor'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    // Close (X) exits to reading; the context sheet must not pop back up.
    fireEvent.press(screen.getByTestId('entity-sheet-close'));
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
    expect(screen.queryByTestId('context-sheet')).toBeNull();
  });

  it('unwinds one card at a time and exits from the first', () => {
    function Flow() {
      const [open, setOpen] = useState(true);
      return <ContextFlow visible={open} onClose={() => setOpen(false)} />;
    }
    render(<Flow />);
    fireEvent.press(screen.getByTestId('context-person-nehemiah-governor'));
    fireEvent.press(screen.getByTestId('connected-artaxerxes-i'));
    // On Artaxerxes I; Back returns to the previous card (Nehemiah).
    fireEvent.press(screen.getByTestId('fullcard-back'));
    const sheet = screen.getByTestId('entity-sheet');
    expect(within(sheet).getAllByText('Nehemiah').length).toBeGreaterThanOrEqual(1);
    // Back from the first card exits to reading; the context sheet does not
    // pop back up.
    fireEvent.press(screen.getByTestId('fullcard-back'));
    expect(screen.queryByTestId('entity-sheet')).toBeNull();
    expect(screen.queryByTestId('context-sheet')).toBeNull();
  });

  it('opens an event full card from a History event chip', () => {
    render(<ContextFlow visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('context-tabs-1'));
    fireEvent.press(screen.getByTestId('context-event-audience-with-artaxerxes'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getAllByText('Audience With Artaxerxes').length).toBeGreaterThanOrEqual(1);
    // Participants are actionable chips, not inert prose.
    expect(screen.getByTestId('event-participant-nehemiah-governor')).toBeTruthy();
  });
});
