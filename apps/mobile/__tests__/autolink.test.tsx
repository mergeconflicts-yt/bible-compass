import { fireEvent, render, screen } from '@testing-library/react-native';
import { splitReferences } from '@/lib/autolink';
import { ReferenceText } from '@/components/ReferenceText';

const context = { bookOsis: 'Neh', chapter: 2 };

describe('splitReferences', () => {
  it('resolves chapter, verse and range addresses', () => {
    expect(splitReferences('See Neh 1 here', context)).toEqual([
      { text: 'See ', passageKey: null },
      { text: 'Neh 1', passageKey: 'Neh.1' },
      { text: ' here', passageKey: null },
    ]);
    expect(splitReferences('Ezra 4:17–23', context)).toEqual([
      { text: 'Ezra 4:17–23', passageKey: 'Ezra.4.17-Ezra.4.23' },
    ]);
    expect(splitReferences('Neh 6:15', context)).toEqual([
      { text: 'Neh 6:15', passageKey: 'Neh.6.15' },
    ]);
  });

  it('resolves verse-relative forms against the chapter', () => {
    expect(splitReferences('grieved (v10) and mocked', context)).toEqual([
      { text: 'grieved (', passageKey: null },
      { text: 'v10', passageKey: 'Neh.2.10' },
      { text: ') and mocked', passageKey: null },
    ]);
    expect(splitReferences('vv13–15', context)).toEqual([
      { text: 'vv13–15', passageKey: 'Neh.2.13-Neh.2.15' },
    ]);
    expect(splitReferences('vv13, 15', context)).toEqual([
      { text: 'vv13, 15', passageKey: 'Neh.2.13-Neh.2.15' },
    ]);
  });

  it('resolves registry book names', () => {
    expect(splitReferences('Named in Nehemiah 2:19', context)[1]).toEqual({
      text: 'Nehemiah 2:19',
      passageKey: 'Neh.2.19',
    });
  });

  it('leaves years, counts, bare ranges, canonical keys and unknown books alone', () => {
    for (const text of [
      'About 445 BC',
      'finished in 52 days',
      'Chapters 1–7',
      'Narnia 2',
      'Neh.2.4',
      '',
    ]) {
      const spans = splitReferences(text, context);
      expect(spans.every((span) => span.passageKey === null)).toBe(true);
      expect(spans.map((span) => span.text).join('')).toBe(text);
    }
  });
});

describe('ReferenceText', () => {
  it('opens the referenced passage on press', () => {
    const onOpenPassage = jest.fn();
    render(
      <ReferenceText text="Grieved by arrival (v10) and more" onOpenPassage={onOpenPassage} />,
    );
    expect(screen.getByLabelText('Open v10')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open v10'));
    expect(onOpenPassage).toHaveBeenCalledWith('Neh.2.10');
  });

  it('renders plain prose untouched without a navigator', () => {
    render(<ReferenceText text="Grieved (v10) as ever" />);
    expect(screen.getByText('Grieved (v10) as ever')).toBeTruthy();
    expect(screen.queryByLabelText('Open v10')).toBeNull();
  });
});
