'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

const COLORS = ['#3266ad','#1d9e75','#d85a30','#ba7517','#993556','#534ab7','#0f6e56','#639922']

function fmt(n: number): string {
  return '৳' + (n || 0).toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtShort(n: number): string {
  const v = n || 0
  if (v >= 1000000) return '৳' + (v / 1000000).toFixed(2) + 'M'
  if (v >= 1000)    return '৳' + (v / 1000).toFixed(1) + 'K'
  return '৳' + v.toFixed(0)
}

interface Metrics {
  totalLines: number; totalPcs: number; totalFreePcs: number
  totalGross: number; totalDiscount: number; totalNet: number
  uniqueOutlets: number; uniqueSOs: number
}
interface ChartItem { name: string; value: number }
interface Charts { byRegion: ChartItem[]; byTerritory: ChartItem[]; bySO: ChartItem[]; byArea: ChartItem[] }
interface Order {
  OrderDate: string; Region: string; Area: string; Territory: string; Town: string
  SOName: string; OutletName: string; BrandName: string; SKUName: string
  OrderPcs: number; FreePcs: number; GrossTP: number; Discount: number; NetTP: number
}
interface Filters {
  regions: string[]; areas: string[]; territories: string[]; soNames: string[]
}

function BarChart({ data, title }: { data: ChartItem[]; title: string }) {
  const max = data.length > 0 ? Math.max(...data.map(d => d.value)) : 1
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      {data.length === 0
        ? <p className="text-xs text-gray-400 text-center py-6">No data</p>
        : <div className="space-y-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 truncate text-gray-500" title={d.name}>{d.name}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                  <div className="h-full rounded flex items-center px-1.5 text-white text-[10px] font-medium"
                    style={{ width: Math.max((d.value / max) * 100, 8) + '%', background: COLORS[i % COLORS.length] }}>
                    {d.value / max > 0.3 ? fmtShort(d.value) : ''}
                  </div>
                </div>
                <span className="w-14 text-right shrink-0 text-gray-400">{fmtShort(d.value)}</span>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

export default function Page() {
  // Filter state
  const [region,    setRegion]    = useState('')
  const [area,      setArea]      = useState('')
  const [territory, setTerritory] = useState('')
  const [soName,    setSoName]    = useState('')
  const [search,    setSearch]    = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')
  const [page,      setPage]      = useState(0)

  // Data state
  const [filters,  setFilters]  = useState<Filters>({ regions:[], areas:[], territories:[], soNames:[] })
  const [metrics,  setMetrics]  = useState<Metrics | null>(null)
  const [charts,   setCharts]   = useState<Charts | null>(null)
  const [orders,   setOrders]   = useState<Order[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  const pageSize  = 20
  const abortRef  = useRef<AbortController | null>(null)

  // Build query string from current filters
  const buildQS = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams()
    if (region)    p.set('region',    region)
    if (area)      p.set('area',      area)
    if (territory) p.set('territory', territory)
    if (soName)    p.set('soName',    soName)
    if (search)    p.set('search',    search)
    if (dateFrom)  p.set('dateFrom',  dateFrom)
    if (dateTo)    p.set('dateTo',    dateTo)
    if (extra) Object.entries(extra).forEach(([k,v]) => p.set(k,v))
    return p.toString()
  }, [region, area, territory, soName, search, dateFrom, dateTo])

  // Fetch cascading filter options whenever parent filters change
  useEffect(() => {
    fetch('/api/orders?mode=filters&' + buildQS())
      .then(r => r.json())
      .then((d: Filters) => setFilters(d))
      .catch(() => {})
  }, [region, area, territory, buildQS])

  // Main data fetch with abort + debounce
  useEffect(() => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setLoading(true)
    setError('')

    const base    = buildQS()
    const tableQS = buildQS({ page: String(page), pageSize: String(pageSize) })

    Promise.all([
      fetch('/api/orders?mode=summary&' + base,          { signal: ctrl.signal }).then(r => r.json()),
      fetch('/api/orders?mode=charts&'  + base,          { signal: ctrl.signal }).then(r => r.json()),
      fetch('/api/orders?mode=table&'   + tableQS,       { signal: ctrl.signal }).then(r => r.json()),
    ])
      .then(([s, c, t]) => {
        setMetrics(s)
        setCharts(c)
        setOrders(t.data || [])
        setTotal(t.total || 0)
        setLoading(false)
      })
      .catch(e => {
        if (e.name !== 'AbortError') {
          setError('Failed to load data.')
          setLoading(false)
        }
      })
  }, [buildQS, page])

  // Reset downstream filters when parent changes
  const handleRegion = (v: string)    => { setRegion(v);    setArea(''); setTerritory(''); setSoName(''); setPage(0) }
  const handleArea = (v: string)      => { setArea(v);      setTerritory(''); setSoName(''); setPage(0) }
  const handleTerritory = (v: string) => { setTerritory(v); setSoName(''); setPage(0) }
  const handleSO = (v: string)        => { setSoName(v);    setPage(0) }

  const clearAll = () => {
    setRegion(''); setArea(''); setTerritory(''); setSoName('')
    setSearch(''); setDateFrom(''); setDateTo(''); setPage(0)
  }

  const hasFilters = region || area || territory || soName || search || dateFrom || dateTo
  const totalPages = Math.ceil(total / pageSize)

  const selCls  = 'text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none hover:border-blue-400 transition-colors'
  const btnCls  = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const dateCls = 'text-sm px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 cursor-pointer'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">R</div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">RHBL Order Dashboard</h1>
              <p className="text-xs text-gray-400">Live data from MongoDB</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Date range */}
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              <span className="text-xs text-gray-400">From</span>
              <input type="date" className={dateCls} value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(0) }} />
              <span className="text-xs text-gray-400">To</span>
              <input type="date" className={dateCls} value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(0) }} />
            </div>

            {/* Region */}
            <select className={selCls} value={region} onChange={e => handleRegion(e.target.value)}>
              <option value="">All Regions</option>
              {filters.regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            {/* Area — filtered by region */}
            <select className={selCls} value={area} onChange={e => handleArea(e.target.value)}>
              <option value="">All Areas</option>
              {filters.areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            {/* Territory — filtered by region+area */}
            <select className={selCls} value={territory} onChange={e => handleTerritory(e.target.value)}>
              <option value="">All Territories</option>
              {filters.territories.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* SO — filtered by region+area+territory */}
            <select className={selCls} value={soName} onChange={e => handleSO(e.target.value)}>
              <option value="">All SOs</option>
              {filters.soNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {hasFilters && (
              <button onClick={clearAll}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label:'Order lines', value: metrics != null ? String(metrics.totalLines ?? 0)               : '—', sub:'',                                                               color:'#3266ad' },
            { label:'Total pcs',   value: metrics != null ? String(metrics.totalPcs   ?? 0)               : '—', sub:'Free: '+String(metrics != null ? (metrics.totalFreePcs??0) : 0), color:'#1d9e75' },
            { label:'Gross TP',    value: metrics != null ? fmtShort(metrics.totalGross    ?? 0)           : '—', sub:'',                                                               color:'#1d9e75' },
            { label:'Discount',    value: metrics != null ? fmtShort(metrics.totalDiscount ?? 0)           : '—', sub:'',                                                               color:'#d85a30' },
            { label:'Net TP',      value: metrics != null ? fmtShort(metrics.totalNet      ?? 0)           : '—', sub:'',                                                               color:'#534ab7' },
            { label:'Outlets',     value: metrics != null ? String(metrics.uniqueOutlets   ?? 0)           : '—', sub:String(metrics != null ? (metrics.uniqueSOs??0):0)+' SOs',       color:'#993556' },
          ].map((m, i) => (
            <div key={i} style={{ borderLeft: '4px solid ' + m.color }}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className="text-xl font-semibold text-gray-900">{m.value}</p>
              {m.sub && <p className="text-xs text-gray-400 mt-1">{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !charts
            ? [1,2,3,4].map(i => <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />)
            : charts
              ? <>
                  <BarChart data={charts.byRegion}    title="Net TP by Region" />
                  <BarChart data={charts.byTerritory} title="Net TP by Territory" />
                  <BarChart data={charts.bySO}        title="Top SOs by Net TP" />
                  <BarChart data={charts.byArea}      title="Net TP by Area" />
                </>
              : null}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-medium text-gray-800 flex-1">
              Order lines {loading && <span className="text-xs text-gray-400 font-normal ml-1">Loading…</span>}
            </h2>
            <input type="text" placeholder="Search outlet, SKU, SO, town…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 w-64 focus:outline-none" />
          </div>

          {orders.length === 0 && !loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date','Region','Area','Territory','Town','SO Name','Outlet','Brand','SKU','Pcs','Free','Gross TP','Disc','Net TP'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={loading ? 'opacity-40' : ''}>
                  {orders.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">{row.OrderDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Region}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.Area}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.Territory}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Town}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.SOName}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate" title={row.OutletName}>{row.OutletName}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 whitespace-nowrap">{row.BrandName}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[140px] truncate text-gray-500" title={row.SKUName}>{row.SKUName}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.OrderPcs}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{row.FreePcs > 0 ? row.FreePcs : '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-400">{fmt(row.GrossTP)}</td>
                      <td className="px-3 py-2 text-right text-orange-500">{row.Discount > 0 ? row.Discount : '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(row.NetTP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{(total || 0).toLocaleString()} rows{total > 0 ? ' · page ' + (page+1) + ' of ' + totalPages : ''}</span>
            <div className="flex gap-1">
              <button className={btnCls} disabled={page === 0}               onClick={() => setPage(0)}>««</button>
              <button className={btnCls} disabled={page === 0}               onClick={() => setPage(p => p-1)}>‹</button>
              <button className={btnCls} disabled={page >= totalPages-1}     onClick={() => setPage(p => p+1)}>›</button>
              <button className={btnCls} disabled={page >= totalPages-1}     onClick={() => setPage(totalPages-1)}>»»</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
