// Address matching between OpenStreetMap and the city's datasets, which spell streets differently:
// OSM says "South Doctor Martin Luther King Junior Drive", violations say "S DR MARTIN L KING JR",
// affordable housing says "6100-24 S. King Dr.". Everything is reduced to { lo, hi, dir, key }.

const DIRS = { NORTH: 'N', SOUTH: 'S', EAST: 'E', WEST: 'W', N: 'N', S: 'S', E: 'E', W: 'W' }
const TYPES = new Set(['AVENUE', 'AVE', 'STREET', 'ST', 'BOULEVARD', 'BLVD', 'DRIVE', 'DR', 'ROAD', 'RD', 'PLACE', 'PL',
  'COURT', 'CT', 'PARKWAY', 'PKWY', 'TERRACE', 'TER', 'LANE', 'LN', 'WAY', 'HIGHWAY', 'HWY', 'SQUARE', 'SQ', 'CIRCLE', 'CIR'])
const WORDS = { DOCTOR: 'DR', JUNIOR: 'JR', SAINT: 'ST', MOUNT: 'MT' }

// Street name as the city's datasets write it ("ST LOUIS", "81ST"), with every Martin Luther King Jr spelling as "MLK".
export function streetKey(words) {
  const name = words.map((w) => WORDS[w] ?? w).join(' ')
  return /\bKING\b/.test(name) && (/MARTIN/.test(name) || name === 'KING') ? 'MLK' : name
}

// "4814-58 N. Kedzie Ave." -> { lo: 4814, hi: 4858, dir: 'N', key: 'KEDZIE' }; null when there's no house number.
export function parseAddress(text) {
  const words = String(text).toUpperCase().replace(/[.,#]/g, ' ').trim().split(/\s+/)
  const m = words[0]?.match(/^(\d+)(?:-(\d+))?$/)
  if (!m) return null
  const lo = +m[1]
  // "6100-24" means 6100 to 6124: the second number replaces the last digits of the first.
  const hi = m[2] ? +(m[1].slice(0, m[1].length - m[2].length) + m[2]) : lo
  let rest = words.slice(1)
  const dir = DIRS[rest[0]] && rest.length > 1 ? DIRS[rest.shift()] : ''
  // Drop the street type, unless that would leave nothing ("PARK").
  if (rest.length > 1 && TYPES.has(rest.at(-1))) rest = rest.slice(0, -1)
  return { lo, hi: Math.max(lo, hi), dir, key: streetKey(rest) }
}

// Same street and the house number falls inside the range.
export const sameBuilding = (a, b) =>
  !!a && !!b && a.key === b.key && (!a.dir || !b.dir || a.dir === b.dir) && a.lo <= b.hi && b.lo <= a.hi

// SoQL filter for one address in datasets with street_number / street_direction / street_name columns.
export function streetWhere({ lo, dir, key }) {
  const name = key === 'MLK' ? "street_name like '%MARTIN%KING%'" : `street_name = '${key.replaceAll("'", "''")}'`
  return `street_number = '${lo}' AND street_direction = '${dir}' AND ${name}`
}

// OSM result + what was typed -> parsed address. The typed number wins: OSM sometimes answers "1235-1241"
// for a typed "1235", and the renter means their door.
export function fromGeocode(typed, hit) {
  const road = hit?.address?.road
  const num = String(typed).trim().match(/^\d+/)?.[0] ?? hit?.address?.house_number?.match(/^\d+/)?.[0]
  if (!road || !num) return null
  return parseAddress(`${num} ${road}`)
}
