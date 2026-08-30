export function validateSecret(s: string): string | null {
  if (typeof s !== 'string' || s.length !== 4) return '请输入4位数字'
  if (!/^\d{4}$/.test(s)) return '只能包含数字0-9'
  if (new Set(s).size !== 4) return '每位数字不能重复'
  return null
}

export function validateGuess(s: string): string | null {
  return validateSecret(s)
}
