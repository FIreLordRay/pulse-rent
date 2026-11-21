import { fromGeocode, parseAddress, sameBuilding, streetWhere } from './address.js'

const SEARCH = 'https://nominatim.openstreetmap.org/search'
const BOX = '-87.94,42.03,-87.52,41.64'   // Chicago's bounding box, so "Main St" finds the Chicago one
const B = 'https://data.cityofchicago.org/resource'

// 311 request types about the building itself or living conditions in it.
export const COMPLAINTS = ['Building Violation', 'Buildings - Plumbing Violation', 'No Air Conditioning', 'Porch Inspection Request',
  'Vacant/Abandoned Building Complaint', 'No Building Permit and Construction Violation', 'Rodent Baiting/Rat Complaint',
  'No Water Complaint', 'Water in Basement Complaint', 'Lead Inspection Request']

// Same as Pulse's lookupAddress, plus street details so the city's records can be matched to the door.
// The address stays in memory only, never in the URL.
export async function lookupAddress(text) {
  const params = new URLSearchParams({ q: `${text}, Chicago, IL`, format: 'jsonv2', limit: 1, addressdetails: 1, viewbox: BOX, bounded: 1 })
  const res = await fetch(`${SEARCH}?${params}`, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`address search failed (HTTP ${res.status})`)
  const [hit] = await res.json()
  const addr = fromGeocode(text, hit)
  return addr && { ...addr, label: `${addr.lo} ${hit.address.road}`, zip: hit.address.postcode }
}

// The portal answers "Service unavailable" often, so retry (from Pulse's scripts/extras.js, shorter waits for a live page).
async function get(id, params) {
  const url = `${B}/${id}.json?` + new URLSearchParams({ $limit: 5000, ...params })
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (res?.ok) return res.json()
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('the City of Chicago data portal is not answering right now')
}

const q = (s) => `'${s.replaceAll("'", "''")}'`

// Everything the city has on one building. Violations are grouped by the city's property_group, which ties
// every address of one building together (7845 to 7859 S Avalon is one group), so the report covers the building.
export async function buildingReport(addr) {
  const groups = await get('22u3-xenr', { $select: 'property_group', $where: streetWhere(addr), $group: 'property_group' })
  const ids = groups.map((g) => g.property_group).filter(Boolean)
  const violations = ids.length
    ? await get('22u3-xenr', {
      $select: 'id, address, violation_date, violation_status, violation_status_date, violation_description, violation_inspector_comments, inspection_category',
      $where: `property_group in (${ids.map(q).join(',')})`, $order: 'violation_date DESC',
    })
    : []
  const addresses = [...new Set(violations.map((v) => v.address))]
  const since = new Date(Date.now() - 3 * 365 * 864e5).toISOString().slice(0, 10)
  // Match 311 on street fields, not street_address: the two datasets spell some streets differently (MLK Dr).
  const doors = [addr, ...addresses.map(parseAddress).filter(Boolean)]
  const where311 = [...new Set(doors.map((d) => `(${streetWhere(d)})`))].join(' OR ')

  const [requests, scofflaws, affordable] = await Promise.all([
    get('v6vf-nfxy', {
      $select: 'sr_number, sr_type, status, created_date, closed_date, street_address',
      $where: `created_date > '${since}' AND sr_type in (${COMPLAINTS.map(q).join(',')}) AND duplicate = false AND `
        + `(${where311})`,
      $order: 'created_date DESC',
    }),
    get('crg5-4zyp', { $select: 'defendant_owner, address, secondary_address, tertiary_address, building_list_date, circuit_court_case_number' }),
    get('s6ha-ppgi', { $select: 'property_name, property_type, address, units, management_company, phone_number' }),
  ])
  // Both lists are a few hundred rows with free-form addresses ("6100-24 S. Prairie Ave."), so match here, not in SoQL.
  const hit = (...texts) => texts.some((t) => t && doors.some((a) => sameBuilding(parseAddress(t), a)))
  return {
    violations,
    requests,
    scofflaw: scofflaws.filter((s) => hit(s.address, s.secondary_address, s.tertiary_address)),
    affordable: affordable.filter((a) => hit(a.address)),
    addresses,
  }
}

// When each dataset last changed, from the portal's own metadata.
export async function updatedDates() {
  const ids = { violations: '22u3-xenr', requests: 'v6vf-nfxy', scofflaw: 'crg5-4zyp', affordable: 's6ha-ppgi' }
  const out = {}
  await Promise.all(Object.entries(ids).map(async ([k, id]) => {
    const r = await fetch(`https://data.cityofchicago.org/api/views/${id}.json`).catch(() => null)
    const j = r?.ok && (await r.json())
    if (j?.rowsUpdatedAt) out[k] = new Date(j.rowsUpdatedAt * 1000)
  }))
  return out
}
