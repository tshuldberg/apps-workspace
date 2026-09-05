import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import PaymentsOpsPage from '../page';

describe('PaymentsOpsPage', () => {
  it('renders launch review evidence and do-not-launch reasons', async () => {
    const element = await PaymentsOpsPage();
    render(element);

    expect(screen.getByText('Launch review')).toBeInTheDocument();
    expect(screen.getAllByText('Do not launch')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Provider profile').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('synctera').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Release state').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Evidence timestamps')).toBeInTheDocument();
    expect(screen.getByText('Captured release evidence')).toBeInTheDocument();
    expect(screen.getByText('Release evidence capture eligibility')).toBeInTheDocument();
    expect(screen.getByText('0 of 4 capture workflows eligible. Blocked items are not persisted.')).toBeInTheDocument();
    expect(screen.getAllByText('Operator identity required').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Idempotency key required').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Release ticket required').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Persisted release evidence')).toBeInTheDocument();
    expect(screen.getByText('0 immutable records')).toBeInTheDocument();
    expect(screen.getByText('No immutable release evidence has been captured. The current review stays pending until real approvals are supplied.')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Attach legal approval for the current automated evidence before release review.')).toBeInTheDocument();
    expect(screen.getByText('Release approval packet is blocked')).toBeInTheDocument();
    expect(screen.getByText('Payments is still hidden')).toBeInTheDocument();
  });
});
