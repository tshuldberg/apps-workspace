import type { AlertRule, AlertConditions } from '../types'

type AlertOperator = AlertRule['operator']

function compare(lhs: number, operator: AlertOperator, rhs: number): boolean {
  if (operator === 'gt') return lhs > rhs
  if (operator === 'gte') return lhs >= rhs
  if (operator === 'lt') return lhs < rhs
  if (operator === 'lte') return lhs <= rhs
  return lhs === rhs
}

export function evaluateAlertRule(
  rule: Pick<AlertRule, 'parameter' | 'operator' | 'value'>,
  conditions: AlertConditions,
): boolean {
  const lhs = conditions[rule.parameter]
  if (lhs == null) return false
  return compare(lhs, rule.operator, rule.value)
}

export function evaluateAlertRules(
  rules: AlertRule[],
  conditions: AlertConditions,
): boolean {
  if (!rules.length) return false

  const sortedRules = [...rules].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )

  let result = evaluateAlertRule(sortedRules[0]!, conditions)

  for (let i = 1; i < sortedRules.length; i++) {
    const rule = sortedRules[i]!
    const ruleMatches = evaluateAlertRule(rule, conditions)
    result =
      rule.joinWith === 'or' ? result || ruleMatches : result && ruleMatches
  }

  return result
}
