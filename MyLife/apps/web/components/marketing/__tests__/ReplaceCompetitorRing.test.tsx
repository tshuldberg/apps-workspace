import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ReplaceCompetitorRing } from '../ReplaceCompetitorRing';

describe('ReplaceCompetitorRing', () => {
  it('renders the ring headline and all competitor logos', () => {
    render(<ReplaceCompetitorRing />);

    expect(
      screen.getByRole('heading', {
        name: /one private life hub instead of twenty separate products/i,
      }),
    ).toBeInTheDocument();

    const logos = screen.getAllByRole('img', { name: /logo$/i });
    expect(logos).toHaveLength(20);
    expect(screen.getByAltText(/goodreads logo/i)).toBeInTheDocument();
    expect(screen.getByAltText(/eventbrite logo/i)).toBeInTheDocument();
  });
});
