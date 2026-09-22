import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from '@/components/shared/EmptyState';
import {
  EmptyCalendarIllustration,
  EmptyChatIllustration,
  EmptyCoursesIllustration,
  EmptyResourcesIllustration,
} from '@/components/shared/illustrations';

const Illustrations = [
  ['EmptyCoursesIllustration', EmptyCoursesIllustration],
  ['EmptyResourcesIllustration', EmptyResourcesIllustration],
  ['EmptyCalendarIllustration', EmptyCalendarIllustration],
  ['EmptyChatIllustration', EmptyChatIllustration],
];

// Lives here, not in production: the point is to tell EmptyState's own markup
// apart from whatever it was handed.
const TestIcon = (props) => <svg data-testid="icon" {...props} />;

describe('EmptyState', () => {
  it('keeps the icon circle when no illustration is given', () => {
    render(<EmptyState icon={TestIcon} title="No resources yet" />);

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('replaces the icon circle when an illustration is given', () => {
    const { container } = render(
      <EmptyState
        illustration={EmptyCoursesIllustration}
        icon={TestIcon}
        title="No courses yet"
      />,
    );

    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(1);
    expect(svgs[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders the copy whether or not an illustration is present', () => {
    render(
      <EmptyState
        illustration={EmptyChatIllustration}
        title="No conversations"
        description="Ask your first question to get started."
      />,
    );

    expect(screen.getByRole('heading', { name: 'No conversations' })).toBeInTheDocument();
    expect(screen.getByText('Ask your first question to get started.')).toBeInTheDocument();
  });
});

describe.each(Illustrations)('%s', (_name, Illustration) => {
  it('is decorative and inherits its colour from the theme', () => {
    const { container } = render(<Illustration />);
    const svg = container.querySelector('svg');

    // A baked-in hue would break dark mode; currentColor keeps it token-driven.
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg.innerHTML).toContain('<path');
  });
});
