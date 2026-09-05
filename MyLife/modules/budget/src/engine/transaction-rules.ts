/**
 * Transaction auto-categorization rules engine.
 *
 * Evaluates rule conditions against incoming transactions and applies actions
 * (set envelope, rename payee, set memo). Rules are evaluated in priority
 * order; first match wins unless a rule is marked as non-exclusive.
 *
 * In the hub, "category" maps to "envelope" -- rules can auto-assign
 * transactions to envelopes.
 *
 * All amounts in integer cents.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConditionField = 'payee' | 'amount' | 'account_id' | 'memo';
export type ConditionOperator =
  | 'contains'
  | 'equals'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'between';

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;        // string comparison value, or number as string for amount
  value2?: string;      // second value for 'between' operator
  caseSensitive?: boolean;
}

export type ActionType = 'set_envelope' | 'rename_payee' | 'set_memo';

export interface RuleAction {
  type: ActionType;
  value: string; // envelope_id for set_envelope, new string for rename/memo
}

export interface TransactionRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isEnabled: boolean;
  matchAll: boolean; // true = AND all conditions, false = OR
}

export interface TransactionInput {
  payee: string;
  amount: number; // cents
  accountId: string;
  memo?: string;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  actions: RuleAction[];
}

export interface ApplyRulesResult {
  matches: RuleMatch[];
  envelopeId: string | null;
  payee: string;
  memo: string | null;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Evaluate whether a single condition matches a transaction.
 */
export function evaluateCondition(condition: RuleCondition, transaction: TransactionInput): boolean {
  const caseSensitive = condition.caseSensitive ?? false;

  switch (condition.field) {
    case 'payee': {
      const txnVal = caseSensitive ? transaction.payee : transaction.payee.toLowerCase();
      const condVal = caseSensitive ? condition.value : condition.value.toLowerCase();

      switch (condition.operator) {
        case 'contains': return txnVal.includes(condVal);
        case 'equals': return txnVal === condVal;
        case 'starts_with': return txnVal.startsWith(condVal);
        case 'ends_with': return txnVal.endsWith(condVal);
        case 'regex': return new RegExp(condition.value, caseSensitive ? '' : 'i').test(transaction.payee);
        default: return false;
      }
    }
    case 'memo': {
      const memoVal = transaction.memo ?? '';
      const txnVal = caseSensitive ? memoVal : memoVal.toLowerCase();
      const condVal = caseSensitive ? condition.value : condition.value.toLowerCase();

      switch (condition.operator) {
        case 'contains': return txnVal.includes(condVal);
        case 'equals': return txnVal === condVal;
        case 'starts_with': return txnVal.startsWith(condVal);
        case 'ends_with': return txnVal.endsWith(condVal);
        case 'regex': return new RegExp(condition.value, caseSensitive ? '' : 'i').test(memoVal);
        default: return false;
      }
    }
    case 'amount': {
      const amount = transaction.amount;
      const target = parseInt(condition.value, 10);

      switch (condition.operator) {
        case 'equals': return amount === target;
        case 'greater_than': return amount > target;
        case 'less_than': return amount < target;
        case 'between': {
          const target2 = parseInt(condition.value2 ?? '0', 10);
          return amount >= Math.min(target, target2) && amount <= Math.max(target, target2);
        }
        default: return false;
      }
    }
    case 'account_id': {
      switch (condition.operator) {
        case 'equals': return transaction.accountId === condition.value;
        default: return false;
      }
    }
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a rule against a transaction.
 */
export function evaluateConditions(rule: TransactionRule, transaction: TransactionInput): boolean {
  if (rule.conditions.length === 0) return false;

  if (rule.matchAll) {
    return rule.conditions.every((c) => evaluateCondition(c, transaction));
  }
  return rule.conditions.some((c) => evaluateCondition(c, transaction));
}

/**
 * Check if a single rule matches a transaction.
 */
export function matchRule(rule: TransactionRule, transaction: TransactionInput): RuleMatch | null {
  if (!rule.isEnabled) return null;
  if (!evaluateConditions(rule, transaction)) return null;

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    actions: rule.actions,
  };
}

/**
 * Apply all rules to a transaction in priority order. First match determines
 * envelope assignment; multiple matches can contribute payee renames and memos.
 */
export function applyRules(
  rules: TransactionRule[],
  transaction: TransactionInput,
): ApplyRulesResult {
  // Sort by priority ascending (lower = higher priority)
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  const matches: RuleMatch[] = [];
  let envelopeId: string | null = null;
  let payee = transaction.payee;
  let memo: string | null = transaction.memo ?? null;

  for (const rule of sorted) {
    const match = matchRule(rule, transaction);
    if (!match) continue;

    matches.push(match);

    for (const action of match.actions) {
      switch (action.type) {
        case 'set_envelope':
          if (envelopeId === null) envelopeId = action.value;
          break;
        case 'rename_payee':
          payee = action.value;
          break;
        case 'set_memo':
          memo = action.value;
          break;
      }
    }
  }

  return { matches, envelopeId, payee, memo };
}
