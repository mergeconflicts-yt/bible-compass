import { fireEvent, render, screen } from '@testing-library/react-native';
import { EntityChip, EventChip } from '@/components/EntityChip';
import { ContextSheet } from '@/components/sheets/ContextSheet';
import { ContextFlow } from '@/components/sheets/ContextFlow';
import { foregroundEvents } from '@/content/neh2Draft';

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
    const request = foregroundEvents()[0];
    if (!request) throw new Error('expected a foreground event in the draft');
    const onPress = jest.fn();
    render(
      <EventChip
        title={request.title}
        qualifier="445 BC"
        onPress={onPress}
        testID="event-chip-test"
      />,
    );
    expect(screen.getByText('Nehemiah before Artaxerxes')).toBeTruthy();
    expect(screen.getByText('445 BC')).toBeTruthy();
    fireEvent.press(screen.getByTestId('event-chip-test'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('ContextSheet entity chips', () => {
  const sheetProps = {
    onClose: jest.fn(),
    onOpenEntity: jest.fn(),
    onOpenTimeline: jest.fn(),
    onOpenMap: jest.fn(),
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

  it('lists time and events as chips on the History tab', () => {
    render(<ContextSheet visible {...sheetProps} />);
    fireEvent.press(screen.getByTestId('context-tabs-1'));
    expect(screen.getByTestId('context-time-chip')).toBeTruthy();
    expect(screen.getByText('About 445 BC')).toBeTruthy();
    fireEvent.press(screen.getByTestId('context-time-chip'));
    expect(sheetProps.onOpenTimeline).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('context-event-nehemiah-2-request')).toBeTruthy();
    fireEvent.press(screen.getByTestId('context-event-nehemiah-2-request'));
    expect(sheetProps.onOpenEvent).toHaveBeenCalledTimes(1);
  });

  it('opens an event full card from a History event chip', () => {
    render(<ContextFlow visible onClose={jest.fn()} />);
    fireEvent.press(screen.getByTestId('context-tabs-1'));
    fireEvent.press(screen.getByTestId('context-event-nehemiah-2-request'));
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Date: 445 BC')).toBeTruthy();
    expect(screen.getByText(/central event/)).toBeTruthy();
  });
});
