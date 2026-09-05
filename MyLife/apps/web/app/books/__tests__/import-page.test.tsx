import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { importFromCSV } from '../actions';
import BooksImportPage from '../import/page';

vi.mock('../actions', () => ({
  importFromCSV: vi.fn(),
}));

describe('BooksImportPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports the selected source CSV and shows results', async () => {
    vi.mocked(importFromCSV).mockResolvedValue({
      imported: 2,
      skipped: 1,
      errors: ['Skipped duplicate: Dune'],
    });

    const user = userEvent.setup();
    const { container } = render(<BooksImportPage />);

    // Select StoryGraph source
    await user.click(screen.getByRole('button', { name: 'StoryGraph' }));

    const input = container.querySelector('input[type="file"]');
    expect(input).not.toBeNull();

    const csvContent = 'Title,Author\nDune,Frank Herbert';
    const file = new File([csvContent], 'books.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      value: async () => csvContent,
    });

    await user.upload(input as HTMLInputElement, file);
    expect(screen.getByText('books.csv')).toBeInTheDocument();

    // The import button shows "Import N Books" after preview loads
    const importButton = await screen.findByRole('button', { name: /Import.*Books/i });
    await user.click(importButton);

    await waitFor(() => {
      expect(importFromCSV).toHaveBeenCalledWith(
        'storygraph',
        csvContent,
      );
    });

    expect(screen.getByText('Books Imported')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows preview only after a file is selected', () => {
    render(<BooksImportPage />);
    // Goodreads is selected by default; without a file, preview shows placeholder
    expect(screen.getByText('Select a CSV file to preview')).toBeInTheDocument();
  });
});
