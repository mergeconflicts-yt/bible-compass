import { fireEvent, render, screen } from '@testing-library/react-native';
import { EventCard, OtherCard, PersonCard, PlaceCard, TimeCard } from '@/components/Cards';
import { EntitySheet, eventDistance } from '@/components/sheets/EntitySheet';
import { foregroundEvents, getTimeline } from '@/content/neh2Draft';

describe('PersonCard', () => {
  it('shows banner, relevance, connected people, appearances and Know more', () => {
    const onKnowMore = jest.fn();
    const onOpenPassage = jest.fn();
    render(
      <PersonCard
        slug="nehemiah-governor"
        onKnowMore={onKnowMore}
        onOpenPerson={jest.fn()}
        onOpenPassage={onOpenPassage}
      />,
    );
    expect(screen.getByTestId('entity-card-nehemiah-governor')).toBeTruthy();
    expect(screen.getByText('Nehemiah')).toBeTruthy();
    expect(screen.getByText(/cupbearer whose visible sadness/)).toBeTruthy();
    expect(screen.getByTestId('person-nehemiah-governor-connected-artaxerxes-i')).toBeTruthy();
    expect(screen.getByTestId('person-nehemiah-governor-appearance-nehemiah-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('person-nehemiah-governor-appearance-nehemiah-1'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.1');
    fireEvent.press(screen.getByTestId('entity-card-nehemiah-governor-know-more'));
    expect(onKnowMore).toHaveBeenCalledWith('nehemiah-governor');
  });

  it('renders nothing for unknown slugs instead of guessing', () => {
    render(<PersonCard slug="no-such-person" onKnowMore={jest.fn()} />);
    expect(screen.queryByTestId('entity-card-no-such-person')).toBeNull();
  });
});

describe('PlaceCard and OtherCard', () => {
  it('labels places with map-pin visuals and passage roles', () => {
    render(<PlaceCard slug="jerusalem" onKnowMore={jest.fn()} />);
    expect(screen.getByTestId('entity-card-jerusalem')).toBeTruthy();
    expect(screen.getByText('Jerusalem')).toBeTruthy();
  });

  it('falls back to a typed card for empires and roles', () => {
    render(<OtherCard slug="cupbearer" onKnowMore={jest.fn()} />);
    expect(screen.getByTestId('entity-card-cupbearer')).toBeTruthy();
    expect(screen.getByText('Cupbearer')).toBeTruthy();
  });
});

describe('TimeCard and EventCard', () => {  it('shows the period with its precision and a timeline path', () => {
    const onKnowMore = jest.fn();
    render(
      <TimeCard label="About 445 BC" precision="APPROXIMATE" note="Nisan, twentieth year of Artaxerxes." onKnowMore={onKnowMore} />,
    );
    expect(screen.getByTestId('time-card')).toBeTruthy();
    expect(screen.getByText('About 445 BC')).toBeTruthy();
    fireEvent.press(screen.getByText('Open timeline ›'));
    expect(onKnowMore).toHaveBeenCalledTimes(1);
  });

  it('shows the event with date, details and passage relevance', () => {
    const event = foregroundEvents()[0];
    if (!event) throw new Error('expected a foreground event in the draft');
    render(<EventCard event={event} onKnowMore={jest.fn()} />);
    expect(screen.getByTestId(`event-card-${event.canonical_key}`)).toBeTruthy();
    expect(screen.getByText(event.title)).toBeTruthy();
    expect(screen.getByText(event.relevance)).toBeTruthy();
    expect(screen.getByText('Date')).toBeTruthy();
  });
});

describe('EntitySheet full hierarchy', () => {
  const sheetProps = {
    onClose: jest.fn(),
    onOpenEntity: jest.fn(),
    onOpenPassage: jest.fn(),
    onOpenTimeline: jest.fn(),
    onOpenMap: jest.fn(),
  };
  beforeEach(() => jest.clearAllMocks());

  it('renders the person hierarchy with spine, context, profile, facts and a way back', () => {
    render(<EntitySheet visible slug="nehemiah-governor" {...sheetProps} />);
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Nehemiah')).toBeTruthy();
    expect(screen.getAllByText(/cupbearer to Artaxerxes I who sought permission/)).toHaveLength(2);
    expect(screen.getByText('WHO HE STANDS BETWEEN')).toBeTruthy();
    expect(screen.getByTestId('connected-artaxerxes-i')).toBeTruthy();
    expect(screen.getByTestId('fullcard-in-passage')).toBeTruthy();
    expect(screen.getByText('About him')).toBeTruthy();
    expect(screen.queryByText('Context')).toBeNull();
    expect(screen.queryByText('Well attested')).toBeNull();
    expect(screen.getByText(/cupbearer whose visible sadness/)).toBeTruthy();
    expect(screen.getByTestId('fullcard-profile')).toBeTruthy();
    expect(screen.getByText(/Also known as/)).toBeTruthy();
    expect(screen.getByText(/Named in 7 passages/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-appearance-nehemiah-1'));
    expect(sheetProps.onOpenPassage).toHaveBeenCalledWith('Neh.1');
    expect(screen.queryByTestId('fullcard-sources')).toBeNull();
    fireEvent.press(screen.getByTestId('fullcard-sources-toggle'));
    expect(screen.getByTestId('fullcard-sources')).toBeTruthy();
    expect(screen.getByText(/unreviewed/)).toBeTruthy();
    expect(screen.getByText('See him in time')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-lateral'));
    expect(sheetProps.onOpenTimeline).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('fullcard-back'));
    expect(sheetProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the fixed close control without scrolling', () => {
    render(<EntitySheet visible slug="nehemiah-governor" {...sheetProps} />);
    fireEvent.press(screen.getByTestId('entity-sheet-close'));
    expect(sheetProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates sideways through connected people', () => {
    render(<EntitySheet visible slug="sanballat-the-horonite" {...sheetProps} />);
    fireEvent.press(screen.getByTestId('connected-nehemiah-governor'));
    expect(sheetProps.onOpenEntity).toHaveBeenCalledWith('nehemiah-governor');
  });

  it('gives places a locator lateral and no person spine', () => {
    render(<EntitySheet visible slug="jerusalem" {...sheetProps} />);
    expect(screen.getByText('PLACE · PERSIAN PERIOD')).toBeTruthy();
    expect(screen.queryByText('WHO HE STANDS BETWEEN')).toBeNull();
    expect(screen.getByTestId('fullcard-locate')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-locate'));
    expect(sheetProps.onOpenMap).toHaveBeenCalledTimes(1);
    expect(screen.getByText('About the place')).toBeTruthy();
    expect(screen.getAllByText(/damaged ancestral city/)).toHaveLength(2);
  });

  it('omits locator and lateral moves when no opener is provided', () => {
    render(
      <EntitySheet
        visible
        slug="jerusalem"
        onClose={jest.fn()}
        onOpenEntity={jest.fn()}
        onOpenPassage={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('fullcard-locate')).toBeNull();
    expect(screen.queryByTestId('fullcard-lateral')).toBeNull();
  });

  it('renders nothing invented for unknown slugs', () => {
    render(<EntitySheet visible slug="no-such-place" {...sheetProps} />);
    expect(screen.getByText(/no drafted content/)).toBeTruthy();
    expect(screen.queryByTestId('full-card')).toBeNull();
  });
});

describe('Event full cards', () => {
  it('shows distance in time, relevance, date facts and a timeline lateral', () => {
    const events = getTimeline();
    const abraham = events[0];
    if (!abraham) throw new Error('expected timeline events in the draft');
    const onOpenTimeline = jest.fn();
    render(
      <EntitySheet
        visible
        slug={null}
        event={abraham}
        onClose={jest.fn()}
        onOpenEntity={jest.fn()}
        onOpenPassage={jest.fn()}
        onOpenTimeline={onOpenTimeline}
      />,
    );
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(screen.getByText('Abraham')).toBeTruthy();
    expect(screen.getByText('IN TIME')).toBeTruthy();
    expect(screen.getByText(/1,560 years before this scene/)).toBeTruthy();
    expect(screen.getByText(abraham.relevance)).toBeTruthy();
    expect(screen.getByText('Date: 2000 BC')).toBeTruthy();
    expect(screen.getByText('About the event')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-lateral'));
    expect(onOpenTimeline).toHaveBeenCalledTimes(1);
  });

  it('returns null distance when undatable instead of guessing', () => {
    const events = getTimeline();
    const abraham = events[0];
    if (!abraham) throw new Error('expected timeline events in the draft');
    expect(eventDistance(abraham, null)).toBeNull();
    expect(eventDistance(abraham, '-445')).toMatch(/before this scene/);
  });
});
