export { importFromMyBooks } from './importers/books';
export type { BooksImportResult } from './importers/books';

export { importFromMyBudget } from './importers/budget';
export type { BudgetImportResult } from './importers/budget';

export { importFromMyFast } from './importers/fast';
export type { FastImportResult } from './importers/fast';

export { importFromMyRecipes } from './importers/recipes';
export type { RecipesImportResult } from './importers/recipes';

export const MIGRATION_PACKAGE = '@mylife/migration' as const;
