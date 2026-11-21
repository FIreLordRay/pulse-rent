import { describe, expect, it } from 'vitest'
import { parseAddress, sameBuilding, streetWhere, fromGeocode } from './address.js'
import { summarize, verdict } from './report.js'

describe('parseAddress', () => {
  it('reads the city formats', () => {
    expect(parseAddress('7851 S AVALON AVE')).toEqual({ lo: 7851, hi: 7851, dir: 'S', key: 'AVALON' })
    expect(parseAddress('4814-58 N. Kedzie Ave.')).toEqual({ lo: 4814, hi: 4858, dir: 'N', key: 'KEDZIE' })
    expect(parseAddress('1235-1241 W 81ST ST')).toEqual({ lo: 1235, hi: 1241, dir: 'W', key: '81ST' })
    expect(parseAddress('3700 N ST LOUIS AVE').key).toBe('ST LOUIS')
    expect(parseAddress('649 E GROVELAND PARK').key).toBe('GROVELAND PARK')
    expect(parseAddress('Hairpin Lofts')).toBeNull()
  })
  it('treats every Martin Luther King Jr spelling as one street', () => {
    for (const s of ['6100 S DR MARTIN L KING JR DR', '6100 S. King Dr.', '6100 South Doctor Martin Luther King Junior Drive'])
      expect(parseAddress(s).key).toBe('MLK')
    expect(parseAddress('6100 N KINGSTON AVE').key).toBe('KINGSTON')
  })
})

describe('sameBuilding', () => {
  const door = parseAddress('7851 S Avalon Avenue')
  it('matches inside a range on the same street only', () => {
    expect(sameBuilding(parseAddress('7845-59 S. Avalon Ave.'), door)).toBe(true)
    expect(sameBuilding(parseAddress('7861 S AVALON AVE'), door)).toBe(false)
    expect(sameBuilding(parseAddress('7851 S BLACKSTONE AVE'), door)).toBe(false)
    expect(sameBuilding(parseAddress('7851 N AVALON AVE'), door)).toBe(false)
    expect(sameBuilding(null, door)).toBe(false)
  })
})

describe('geocode to query', () => {
  it('keeps the typed house number over an OSM range', () => {
    const a = fromGeocode('1235 w 81st', { address: { house_number: '1235-1241', road: 'West 81st Street' } })
    expect(streetWhere(a)).toBe("street_number = '1235' AND street_direction = 'W' AND street_name = '81ST'")
  })
  it('escapes quotes and handles MLK', () => {
    expect(streetWhere({ lo: 1, dir: 'S', key: "O'BRIEN" })).toContain("'O''BRIEN'")
    expect(streetWhere(parseAddress('6100 S King Dr'))).toContain("like '%MARTIN%KING%'")
  })
  it('returns null without a road', () => expect(fromGeocode('Navy Pier', { address: {} })).toBeNull())
})

describe('verdict', () => {
  const now = Date.parse('2026-11-21')
  const v = (date, status = 'OPEN') => ({ violation_date: date, violation_status: status })
  const base = { violations: [], requests: [], scofflaw: [], affordable: [] }
  it('never calls a building with no records more than "no red flags"', () => {
    expect(verdict(summarize(base, now))).toMatchObject({ level: 'ok' })
  })
  it('ranks scofflaw and many recent open violations as bad, old open ones as a warning', () => {
    expect(verdict(summarize({ ...base, scofflaw: [{}] }, now)).level).toBe('bad')
    expect(verdict(summarize({ ...base, violations: Array(5).fill(v('2026-06-01')) }, now)).level).toBe('bad')
    expect(verdict(summarize({ ...base, violations: [v('2026-06-01')] }, now)).level).toBe('warn')
    const old = summarize({ ...base, violations: [v('2019-01-01'), v('2018-01-01', 'COMPLIED')] }, now)
    expect([old.open, old.recentOpen, verdict(old).level]).toEqual([1, 0, 'warn'])
  })
})
