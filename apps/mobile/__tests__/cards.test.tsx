import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { EntitySheet } from '@/components/sheets/EntitySheet';
import { previewEvents } from '@/content/neh2Preview';

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
    expect(screen.getAllByText(/Jewish official in the Persian court/)).toHaveLength(2);
    expect(screen.getByText('WHO HE STANDS BETWEEN')).toBeTruthy();
    expect(screen.getByTestId('connected-artaxerxes-i')).toBeTruthy();
    expect(screen.getByTestId('fullcard-in-passage')).toBeTruthy();
    expect(screen.getByText('About him')).toBeTruthy();
    expect(screen.queryByText('Context')).toBeNull();
    expect(screen.queryByText('Well attested')).toBeNull();
    expect(screen.getByText(/cupbearer whose visible sadness/)).toBeTruthy();
    expect(screen.getByTestId('fullcard-profile')).toBeTruthy();
    expect(screen.getByText(/Also known as/)).toBeTruthy();
    expect(screen.getByText(/Named in 19 passages/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-appearance-neh-2-10'));
    expect(sheetProps.onOpenPassage).toHaveBeenCalledWith('Neh.2.10');
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
    expect(screen.getByText('PLACE')).toBeTruthy();
    expect(screen.queryByText('WHO HE STANDS BETWEEN')).toBeNull();
    expect(screen.getByTestId('fullcard-locate')).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-locate'));
    expect(sheetProps.onOpenMap).toHaveBeenCalledTimes(1);
    expect(screen.getByText('About the place')).toBeTruthy();
    expect(screen.getByText('The ruined ancestral city Nehemiah seeks to restore.')).toBeTruthy();
    expect(
      within(screen.getByTestId('fullcard-in-passage')).getByText(/ruined ancestral city/),
    ).toBeTruthy();
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
    expect(screen.getByText(/no preview content/)).toBeTruthy();
    expect(screen.queryByTestId('full-card')).toBeNull();
  });
});

describe('Event full cards', () => {
  it('shows scope, participants and places with a timeline lateral', () => {
    const events = previewEvents();
    const audience = events[0];
    if (!audience) throw new Error('expected preview events');
    const onOpenTimeline = jest.fn();
    render(
      <EntitySheet
        visible
        slug={null}
        event={audience}
        onClose={jest.fn()}
        onOpenEntity={jest.fn()}
        onOpenPassage={jest.fn()}
        onOpenTimeline={onOpenTimeline}
      />,
    );
    expect(screen.getByTestId('entity-sheet')).toBeTruthy();
    expect(
      within(screen.getByTestId('entity-sheet')).getByText(
        'Audience With Artaxerxes · Neh.2.1–Neh.2.8',
      ),
    ).toBeTruthy();
    expect(screen.getByText('IN NEHEMIAH 2 · Neh.2.1–Neh.2.8')).toBeTruthy();
    expect(screen.getByText(/With Nehemiah, Artaxerxes I, The queen/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fullcard-lateral'));
    expect(onOpenTimeline).toHaveBeenCalledTimes(1);
  });
});
