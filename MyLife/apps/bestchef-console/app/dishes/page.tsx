import { deleteDishTranslation, upsertDishTranslation } from './actions';
import { requireModerator } from '@/lib/auth';
import { DISH_TRANSLATION_LOCALES } from '@/lib/dish-locales';
import { sanitizeErrorCode } from '@/lib/errors';
import {
  fetchDishTranslations,
  searchDishRows,
  type DishRow,
  type DishTranslationRow,
} from '@/lib/queries';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  dish?: string;
  ok?: string;
  error?: string;
}

function TranslationEditorRow({
  dish,
  locale,
  existing,
  query,
}: {
  dish: DishRow;
  locale: string;
  existing: DishTranslationRow | undefined;
  query: string;
}) {
  return (
    <tr>
      <td className="mono">{locale}</td>
      <td colSpan={2}>
        <form className="inline" action={upsertDishTranslation}>
          <input type="hidden" name="dishId" value={dish.id} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="q" value={query} />
          <input
            type="text"
            name="name"
            placeholder={dish.name}
            defaultValue={existing?.name ?? ''}
            style={{ width: 220 }}
            required
          />
          <input
            type="text"
            name="description"
            placeholder="localized description (optional)"
            defaultValue={existing?.description ?? ''}
            style={{ width: 260 }}
          />
          <select name="status" defaultValue={existing?.status ?? 'approved'}>
            <option value="approved">approved</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </select>
          <button type="submit">{existing ? 'Update' : 'Add'}</button>
        </form>
        {existing ? (
          <div className="muted">
            {existing.source} · {existing.updatedBy ?? '?'} ·{' '}
            <span className="mono">{existing.updatedAt}</span>
          </div>
        ) : null}
      </td>
      <td>
        {existing ? (
          <form className="inline" action={deleteDishTranslation}>
            <input type="hidden" name="dishId" value={dish.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="q" value={query} />
            <button className="danger" type="submit">
              Delete
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}

export default async function DishesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireModerator();
  const params = await searchParams;
  const query = params.q ?? '';
  const admin = createAdminClient();

  let dishes: DishRow[] = [];
  let translations: Map<string, DishTranslationRow> = new Map();
  let loadError: string | null = null;
  try {
    dishes = await searchDishRows(admin, query);
    if (params.dish) {
      translations = await fetchDishTranslations(admin, params.dish);
    }
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'load_failed';
  }
  const selected = params.dish ? (dishes.find((d) => d.id === params.dish) ?? null) : null;
  const errorCode = sanitizeErrorCode(params.error);

  return (
    <>
      <h1>Dish translations</h1>
      {errorCode ? <div className="banner error">{errorCode}</div> : null}
      {params.ok ? <div className="banner ok">{sanitizeErrorCode(params.ok)}</div> : null}
      {loadError ? (
        <div className="banner error">
          Failed to load ({loadError}). Details are in the server logs.
        </div>
      ) : null}

      <form className="inline" method="get" action="/dishes">
        <input type="text" name="q" placeholder="search dishes by name" defaultValue={query} />
        <button type="submit">Search</button>
      </form>

      <div className="card" style={{ marginTop: 12 }}>
        {dishes.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No dishes matched.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dish</th>
                <th>Cuisine</th>
                <th>Submissions</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.id}>
                  <td>
                    <strong>{dish.name}</strong>
                    {dish.nativeName ? <span className="muted"> · {dish.nativeName}</span> : null}
                    <div className="muted mono">{dish.slug}</div>
                  </td>
                  <td>
                    {dish.cuisine} <span className="badge">{dish.category}</span>
                  </td>
                  <td>{dish.submissionCount}</td>
                  <td>
                    <a href={`/dishes?${new URLSearchParams({ ...(query ? { q: query } : {}), dish: dish.id }).toString()}`}>
                      {params.dish === dish.id ? 'Editing' : 'Translations'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>
            Translations for {selected.name}{' '}
            <span className="muted mono">{selected.id}</span>
          </h2>
          <table>
            <thead>
              <tr>
                <th>Locale</th>
                <th colSpan={2}>Name / description / status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {DISH_TRANSLATION_LOCALES.map((locale) => (
                <TranslationEditorRow
                  key={locale}
                  dish={selected}
                  locale={locale}
                  existing={translations.get(locale)}
                  query={query}
                />
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginBottom: 0 }}>
            Canonical (English) name and description live on the dish itself; only approved rows
            are visible to users, with exact locale beating the base language (pt-br over pt).
          </p>
        </div>
      ) : params.dish && !loadError ? (
        <div className="banner error">Selected dish is not in the current search results.</div>
      ) : null}
    </>
  );
}
