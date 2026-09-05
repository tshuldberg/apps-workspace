/** IDs for the built-in templates seeded in the V4 migration. */

export const BUILTIN_TEMPLATE_IDS = {
  basic: 'fl_tpl_basic',
  reversed: 'fl_tpl_reversed',
  cloze: 'fl_tpl_cloze',
  vocabulary: 'fl_tpl_vocab',
} as const;

export type BuiltinTemplateKey = keyof typeof BUILTIN_TEMPLATE_IDS;
