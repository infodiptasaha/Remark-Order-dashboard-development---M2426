'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { OrderRow, SummaryMetrics, ChartEntry } from '@/lib/types'

const COLORS = ['#3266ad','#1d9e75','#d85a30','#ba7517','#993556','#534ab7','#0f6e56','#639922']

const fmt = (n: number) =>
  '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtShort = (n: number) => {
  if (n >= 1_000_000) return '৳' + (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return '৳' + (n / 1_000).toFixed(1) + 'K'
  return '৳' + n.toFixed(0)
}

function MetricCard({ label, value, sub, borderColor }: {
  label: string; value: string | number; sub?: string; borderColor: string
}) {
  return (
    <div style={{ borderLeft: `4px solid ${borderColor}` }}
         className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-semibold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function CSSBarChart({ data, title }: { data: ChartEntry[]; title: string }) {
  const max = data.length ? Math.max(...data.map(d => d.value)) : 1
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-8">No data</p>
      ) : (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 text-gray-500 truncate" title={d.name}>{d.name}</span>
              <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                <div
                  className="h-full rounded flex items-center px-1.5 text-white text-[10px] font-medium"
                  style={{
                    width: `${Math.max((d.value / max) * 100, 8)}%`,
                    background: COLORS[i % COLORS.length]
                  }}
                >
                  {(d.value / max) > 0.3 ? fmtShort(d.value) : ''}
                </div>
              </div>
              <span className="w-14 text-right text-gray-400 shrink-0">{fmtShort(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [region,  setRegion]  = useState('')
  const [brand,   setBrand]   = useState('')
  const [soName,  setSoName]  = useState('')
  const [area,    setArea]    = useState('')
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(0)
  const pageSize = 20

  const [filters, setFilters] = useState<{ regions: string[]; brands: string[]; soNames: string[]; areas: string[] } | null>(null)
  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null)
  const [charts,  setCharts]  = useState<{ byRegion: ChartEntry[]; byBrand: ChartEntry[]; bySO: ChartEntry[]; byArea: ChartEntry[] } | null>(null)
  const [orders,  setOrders]  = useState<OrderRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const qs = useCallback(() => {
    const p = new URLSearchParams()
    if (region) p.set('region', region)
    if (brand)  p.set('brand',  brand)
    if (soName) p.set('soName', soName)
    if (area)   p.set('area',   area)
    if (search) p.set('search', search)
    return p.toString()
  }, [region, brand, soName, area, search])

  useEffect(() => {
    fetch('/api/orders?mode=filters')
      .then(r => r.json())
      .then(setFilters)
      .catch(() => setError('Could not load filter options'))
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const base = qs()
    const withPage = base + (base ? '&' : '') + `page=${page}&pageSize=${pageSize}`

    Promise.all([
      fetch(`/api/orders?mode=summary&${base}`).then(r => r.json()),
      fetch(`/api/orders?mode=charts&${base}`).then(r => r.json()),
      fetch(`/api/orders?mode=table&${withPage}`).then(r => r.json()),
    ])
      .then(([sum, ch, tbl]) => {
        setMetrics(sum)
        setCharts(ch)
        setOrders(tbl.data || [])
        setTotal(tbl.total || 0)
      })
      .catch(() => setError('Failed to load data. Check MongoDB connection and environment variables.'))
      .finally(() => setLoading(false))
  }, [qs, page])

  const resetPage = () => setPage(0)

  const handleSearch = (val: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); resetPage() }, 400)
  }

  const clearFilters = () => {
    setRegion(''); setBrand(''); setSoName(''); setArea(''); setSearch(''); resetPage()
  }

  const hasFilters = region || brand || soName || area || search
  const totalPages = Math.ceil(total / pageSize)

  const selClass = "text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none cursor-pointer"
  const btnClass = "px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">R</div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-none">RHBL Order Dashboard</h1>
              <p className="text-xs text-gray-400 mt-0.5">Live data from MongoDB</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className={selClass} value={region} onChange={e => { setRegion(e.target.value); resetPage() }}>
              <option value="">All Regions</option>
              {filters?.regions.map(r => <option key={r}>{r}</option>)}
            </select>
            <select className={selClass} value={area} onChange={e => { setArea(e.target.value); resetPage() }}>
              <option value="">All Areas</option>
              {filters?.areas.map(a => <option key={a}>{a}</option>)}
            </select>
            <select className={selClass} value={brand} onChange={e => { setBrand(e.target.value); resetPage() }}>
              <option value="">All Brands</option>
              {filters?.brands.map(b => <option key={b}>{b}</option>)}
            </select>
            <select className={selClass} value={soName} onChange={e => { setSoName(e.target.value); resetPage() }}>
              <option value="">All SOs</option>
              {filters?.soNames.map(s => <option key={s}>{s}</option>)}
            </select>
            {hasFilters && (
              <button onClick={clearFilters}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>
        )}

        {/* metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Order lines" value={metrics?.totalLines ?? '—'} borderColor="#3266ad" />
          <MetricCard label="Total pcs"   value={metrics?.totalPcs?.toLocaleString() ?? '—'} borderColor="#1d9e75" sub={`Free: ${metrics?.totalFreePcs ?? 0}`} />
          <MetricCard label="Gross TP"    value={metrics ? fmtShort(metrics.totalGross) : '—'} borderColor="#1d9e75" />
          <MetricCard label="Discount"    value={metrics ? fmtShort(metrics.totalDiscount) : '—'} borderColor="#d85a30" />
          <MetricCard label="Net TP"      value={metrics ? fmtShort(metrics.totalNet) : '—'} borderColor="#534ab7" />
          <MetricCard label="Outlets"     value={metrics?.uniqueOutlets ?? '—'} borderColor="#993556" sub={`${metrics?.uniqueSOs ?? 0} SOs`} />
        </div>

        {/* charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !charts
            ? [1,2,3,4].map(i => <div key={i} className="bg-gray-100 rounded-xl h-52 animate-pulse" />)
            : charts
              ? <>
                  <CSSBarChart data={charts.byRegion} title="Net TP by region" />
                  <CSSBarChart data={charts.byBrand}  title="Net TP by brand" />
                  <CSSBarChart data={charts.bySO}     title="Top SOs by net TP" />
                  <CSSBarChart data={charts.byArea}   title="Net TP by area" />
                </>
              : null
          }
        </div>

        {/* table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-medium text-gray-800 flex-1">Order lines</h2>
            <input type="text" placeholder="Search outlet, SKU, SO, town…"
              defaultValue={search}
              onChange={e => handleSearch(e.target.value)}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none w-72" />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">No orders found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date','Region','Area','Town','SO Name','Outlet','Brand','SKU','Pcs','Free','Gross TP','Disc','Net TP'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.OrderDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Region}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.Area}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Town}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.SOName}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate" title={row.OutletName}>{row.OutletName}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 whitespace-nowrap">{row.BrandName}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[160px] truncate text-gray-600" title={row.SKUName}>{row.SKUName}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.OrderPcs}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{row.FreePcs || '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{fmt(row.GrossTP)}</td>
                      <td className="px-3 py-2 text-right text-orange-600">{row.Discount || '—'}</td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(row.NetTP)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>{total.toLocaleString()} rows{total > 0 ? ` · page ${page + 1} of ${totalPages}` : ''}</span>
            <div className="flex gap-2">
              <button className={btnClass} disabled={page === 0} onClick={() => setPage(0)}>««</button>
              <button className={btnClass} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <button className={btnClass} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
              <button className={btnClass} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»»</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
