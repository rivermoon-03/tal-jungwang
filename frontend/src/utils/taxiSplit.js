export function splitFare(totalWon, n) {
  if (totalWon == null || n == null) return null
  if (n <= 0) return null
  if (totalWon === 0) return 0

  const perPerson = totalWon / n
  const rounded = Math.ceil(perPerson / 100) * 100
  return rounded
}

export function formatWon(value) {
  if (value == null) return ''
  return value.toLocaleString() + '원'
}
