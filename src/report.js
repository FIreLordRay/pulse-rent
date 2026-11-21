// Turns the raw city records for one building into the numbers and verdict the page shows.

const YEAR = 365 * 864e5

// "INSTALL SMOKE DETECTORS" -> "Install smoke detectors"
export const sentence = (s) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '')

export function summarize({ violations, requests, scofflaw, affordable }, now = Date.now()) {
  const open = violations.filter((v) => v.violation_status === 'OPEN')
  const ago = (d) => now - new Date(d).getTime()
  const recentOpen = open.filter((v) => ago(v.violation_date) < 2 * YEAR)
  const lastYear = requests.filter((r) => ago(r.created_date) < YEAR)
  return {
    total: violations.length,
    open: open.length,
    recentOpen: recentOpen.length,
    latestOpen: open.slice(0, 4),
    lastInspected: violations[0]?.violation_date ?? null,
    complaints: requests.length,
    complaintsLastYear: lastYear.length,
    scofflaw: scofflaw.length > 0,
    affordable: affordable.length > 0,
  }
}

// One plain line. level: 'bad' | 'warn' | 'ok'. Built only from what the city recorded, so it never says "safe".
export function verdict(s) {
  if (s.scofflaw) return { level: 'bad', text: "This building is on the city's Building Code Scofflaw list: the owner was taken to court over serious violations and did not fix them." }
  if (s.recentOpen >= 5) return { level: 'bad', text: `${s.recentOpen} code violations from the last two years are still open. Ask the landlord what has been fixed, and see it yourself.` }
  if (s.recentOpen > 0) return { level: 'warn', text: `${s.recentOpen} recent code violation${s.recentOpen > 1 ? 's are' : ' is'} still open. Ask the landlord about ${s.recentOpen > 1 ? 'them' : 'it'} before you sign.` }
  if (s.complaintsLastYear >= 3) return { level: 'warn', text: `Neighbors or tenants filed ${s.complaintsLastYear} building complaints with 311 in the last year, but no recent violation is open.` }
  if (s.open > 0) return { level: 'warn', text: `No recent open violations, but ${s.open} older one${s.open > 1 ? 's were' : ' was'} never marked fixed.` }
  if (s.total > 0) return { level: 'ok', text: 'No open code violations: every violation the city found here was marked fixed.' }
  return { level: 'ok', text: 'No red flags in city records. The city has no code violations on file for this building.' }
}
