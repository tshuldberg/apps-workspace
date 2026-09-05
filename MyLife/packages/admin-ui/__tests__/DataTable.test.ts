import { describe, it, expect } from 'vitest';
import { DataTable } from '../src/DataTable';
import type { DataTableProps, Column } from '../src/DataTable';

describe('DataTable', () => {
  it('exports a function component', () => {
    expect(typeof DataTable).toBe('function');
  });

  it('Column type has required fields', () => {
    const col: Column<{ name: string; age: number }> = {
      key: 'name',
      header: 'Name',
      sortable: true,
      width: '200px',
    };
    expect(col.key).toBe('name');
    expect(col.header).toBe('Name');
    expect(col.sortable).toBe(true);
  });

  it('DataTableProps type accepts generic data', () => {
    type Row = { id: number; title: string };
    const props: DataTableProps<Row> = {
      columns: [
        { key: 'id', header: 'ID' },
        { key: 'title', header: 'Title', sortable: true },
      ],
      data: [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second' },
      ],
      emptyMessage: 'No rows',
      loading: false,
      sortBy: 'id',
      sortDirection: 'asc',
    };
    expect(props.columns).toHaveLength(2);
    expect(props.data).toHaveLength(2);
  });
});
