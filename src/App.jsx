import { useEffect, useState } from 'react'
import { Building2, ExternalLink, ClipboardList, Phone, Gavel, House } from 'lucide-react'
import { lookupAddress, buildingReport, updatedDates } from './data.js'
import { summarize, verdict, sentence } from './report.js'

const PULSE = 'https://firelordray.github.io/city-scorecard/'
const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'never')
const fmt = (n) => n.toLocaleString()

export default function App() {
  const [text, setText] = useState('')
  const [state, setState] = useState({ phase: 'idle' })   // idle | looking | done | error
  const [dates, setDates] = useState({})
  useEffect(() => { updatedDates().then(setDates, () => {}) }, [])

  async function check(e) {
    e.preventDefault()
    if (!text.trim()) return
    setState({ phase: 'looking', msg: 'Finding the address…' })
    try {
      const addr = await lookupAddress(text)
      if (!addr) return setState({ phase: 'error', msg: "Couldn't find that as a Chicago street address. Try the house number and street, like 7851 S Avalon Ave." })
      setState({ phase: 'looking', msg: `Pulling city records for ${addr.label}…` })
      const data = await buildingReport(addr)
      setState({ phase: 'done', addr, data, sum: summarize(data) })
    } catch (err) {
      setState({ phase: 'error', msg: `Something didn't load: ${err.message}. Try again in a minute.` })
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <p className="brand"><a href="./">Pulse Rent</a></p>
        <nav aria-label="Views">
          <a href="./" aria-current="page"><Building2 size={18} aria-hidden="true" />Building report</a>
          <a href={PULSE}><House size={18} aria-hidden="true" />Pulse: neighborhoods</a>
        </nav>
        <p className="muted small">Data: City of Chicago. Part of the <a href={PULSE}>Pulse</a> suite.</p>
      </aside>
      <div className="content">
        <main className="panel">
          <section className="landing-hero">
            <h1>Is this building safe to rent?</h1>
            <p className="lede">Type a Chicago address to see what the city has on the building: code violations, 311 complaints, the scofflaw list and affordable housing.</p>
            <form className="landing-search" onSubmit={check} role="search">
              <label htmlFor="addr" className="visually-hidden">Street address</label>
              <input id="addr" value={text} onChange={(e) => setText(e.target.value)} placeholder="Street address, like 7851 S Avalon Ave"
                autoComplete="street-address" disabled={state.phase === 'looking'} />
              <button className="go-btn" disabled={state.phase === 'looking' || !text.trim()}>Check building</button>
            </form>
            <p className="muted small-note">Your address is looked up with OpenStreetMap and never saved or put in the link.</p>
          </section>

          {state.phase === 'looking' && <p className="muted" role="status">{state.msg}</p>}
          {state.phase === 'error' && <p className="error" role="alert">{state.msg}</p>}
          {state.phase === 'done' && <Report {...state} />}
          <Sources dates={dates} />
        </main>
      </div>
    </div>
  )
}

function Report({ addr, data, sum }) {
  const v = verdict(sum)
  const others = data.addresses.length > 1 ? data.addresses.length - 1 : 0
  return (
    <section aria-labelledby="report-h" aria-live="polite">
      <div className={`hero verdict ${v.level}`}>
        <div>
          <h2 id="report-h">{addr.label}</h2>
          {others > 0 && <p className="muted">City records count this as one building with {others} other address{others > 1 ? 'es' : ''}.</p>}
          <p className="headline">{v.text}</p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="muted">Open code violations</span><strong>{fmt(sum.open)}</strong></div>
        <div className="kpi"><span className="muted">All code violations on file</span><strong>{fmt(sum.total)}</strong></div>
        <div className="kpi"><span className="muted">311 building complaints, last 3 years</span><strong>{fmt(sum.complaints)}</strong></div>
        <div className="kpi"><span className="muted">Last violation found</span><strong className="date">{day(sum.lastInspected)}</strong></div>
      </div>

      {sum.scofflaw && <>
        <h2><Gavel size={20} aria-hidden="true" /> On the Building Code Scofflaw list</h2>
        <ol className="nearest">
          {data.scofflaw.map((s) => (
            <li key={s.circuit_court_case_number + s.building_list_date}>
              <span><b>{s.address}</b> <span className="muted">· listed {day(s.building_list_date)}</span></span>
              <span>Owner named in court: {s.defendant_owner}</span>
              <span className="muted">Housing court case {s.circuit_court_case_number}</span>
            </li>
          ))}
        </ol>
      </>}

      <h2><ClipboardList size={20} aria-hidden="true" /> Open violations, newest first</h2>
      {sum.latestOpen.length === 0
        ? <p className="muted">None open right now.</p>
        : <ol className="nearest">
          {sum.latestOpen.map((x) => (
            <li key={x.id}>
              <span><b>{sentence(x.violation_description)}</b> <span className="muted">· found {day(x.violation_date)} · {x.address}</span></span>
              {x.violation_inspector_comments && <span className="muted comment">Inspector: {sentence(x.violation_inspector_comments)}</span>}
            </li>
          ))}
        </ol>}
      {sum.open > sum.latestOpen.length && <p className="muted">Plus {fmt(sum.open - sum.latestOpen.length)} more open violation{sum.open - sum.latestOpen.length > 1 ? 's' : ''}.</p>}

      <h2><Phone size={20} aria-hidden="true" /> Recent 311 complaints about the building</h2>
      {data.requests.length === 0
        ? <p className="muted">No building, plumbing, heat-related, rat or water complaints to 311 in the last 3 years.</p>
        : <ol className="nearest">
          {data.requests.slice(0, 5).map((r) => (
            <li key={r.sr_number}>
              <span><b>{r.sr_type}</b> <span className="muted">· {day(r.created_date)} · {r.status}</span></span>
            </li>
          ))}
        </ol>}

      <h2><House size={20} aria-hidden="true" /> City-supported affordable housing</h2>
      {data.affordable.length === 0
        ? <p className="muted">Not on the city's list of affordable rental buildings.</p>
        : <ol className="nearest">
          {data.affordable.map((a) => (
            <li key={a.address + a.property_name}>
              <span><b>{a.property_name}</b> <span className="muted">· {a.property_type} · {a.units} affordable units</span></span>
              <span className="muted">{a.management_company}{a.phone_number && <> · <a href={`tel:${a.phone_number}`}>{a.phone_number}</a></>}</span>
            </li>
          ))}
        </ol>}

      <div className="act">
        <p>Living here and something is wrong? Report it to the city.</p>
        <a className="btn" href="https://311.chicago.gov" target="_blank" rel="noopener noreferrer">Open CHI311 <ExternalLink size={16} aria-hidden="true" /></a>
      </div>
    </section>
  )
}

function Sources({ dates }) {
  const d = (k) => (dates[k] ? `updated ${day(dates[k])}` : 'update date unavailable')
  return (
    <details className="method">
      <summary>What this covers, and what it can't tell you</summary>
      <p>These records only show what someone reported or an inspector found. A building with no record may simply never have been inspected, and an open violation can be fixed but not yet re-inspected. Always see the unit in person.</p>
      <ul>
        <li>Code violations: <a href="https://data.cityofchicago.org/d/22u3-xenr">Building Violations</a>, {d('violations')}. Grouped by the city's building record, so every address of a building counts.</li>
        <li>311: <a href="https://data.cityofchicago.org/d/v6vf-nfxy">311 Service Requests</a>, {d('requests')}. Building, plumbing, porch, no AC, vacant building, rat, no water, basement water and lead requests, duplicates removed. Heat complaints are filed under "Building Violation".</li>
        <li>Scofflaw list: <a href="https://data.cityofchicago.org/d/crg5-4zyp">Building Code Scofflaw List</a>, {d('scofflaw')}.</li>
        <li>Affordable housing: <a href="https://data.cityofchicago.org/d/s6ha-ppgi">Affordable Rental Housing Developments</a>, {d('affordable')}.</li>
      </ul>
    </details>
  )
}
