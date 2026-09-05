/**
 * Template variable expansion for MyNotes.
 * Replaces {{variable}} patterns with runtime values.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type TemplateVariableMap = Record<string, string>;

/**
 * Build the default variable map from the current date/time.
 */
export function buildVariableMap(now?: Date): TemplateVariableMap {
  const d = now ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`,
    day: DAYS[d.getDay()],
    month: MONTHS[d.getMonth()],
    year: String(yyyy),
  };
}

/**
 * Expand template variables in a body string.
 * Unknown variables are left as literal text (not stripped).
 */
export function expandVariables(body: string, variables?: TemplateVariableMap): string {
  const vars = variables ?? buildVariableMap();
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match;
  });
}
