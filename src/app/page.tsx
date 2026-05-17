'use client'

import { useEffect, useState, useCallback } from 'react'

const COLORS = ['#3266ad','#1d9e75','#d85a30','#ba7517','#993556','#534ab7','#0f6e56','#639922']

function fmt(n: number): string {
  return '৳' + n.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtShort(n: number): string {
  if (n >= 1000000) return '৳' + (n / 1000000).toFixed(2) + 'M'
  if (n >= 1000) return '৳' + (n / 1000).toFixed(1) + 'K'
  return '৳' + n.toFixed(0)
}

interface Metrics {
  totalLines: number
  totalPcs: number
  totalFreePcs: number
  totalGross: number
  totalDiscount: number
  totalNet: number
  uniqueOutlets: number
  uniqueSOs: number
}

interface ChartItem {
  name: string
  value: number
}

interface Charts {
  byRegion: ChartItem[]
  byBrand: ChartItem[]
  bySO: ChartItem[]
  byArea: ChartItem[]
}

interface Order {
  OrderDate: string
  Region: string
  Area: string
  Town: string
  SOName: string
  OutletName: string
  BrandName: string
  SKUName: string
  OrderPcs: number
  FreePcs: number
  GrossTP: number
  Discount: number
  NetTP: number
}

interface Filters {
  regions: string[]
  brands: string[]
  soNames: string[]
  areas: string[]
}

function BarChart({ data, title }: { data: ChartItem[]; title: string }) {
  const max = data.length > 0 ? Math.max(...data.map(d => d.value)) : 1
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-sm font-medium text-gray-700 mb-3">{title}</p>
      {data.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No data</p>
      ) : (
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-gray-500" title={d.name}>{d.name}</span>
              <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                <div
                  className="h-full rounded flex items-center px-1.5 text-white text-[10px] font-medium"
                  style={{ width: Math.max((d.value / max) * 100, 8) + '%', background: COLORS[i % COLORS.length] }}
                >
                  {d.value / max > 0.3 ? fmtShort(d.value) : ''}
                </div>
              </div>
              <span className="w-14 text-right shrink-0 text-gray-400">{fmtShort(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  const [region, setRegion] = useState('')
  const [brand, setBrand] = useState('')
  const [soName, setSoName] = useState('')
  const [area, setArea] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const [filters, setFilters] = useState<Filters | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [charts, setCharts] = useState<Charts | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const pageSize = 20

  const buildQS = useCallback(() => {
    const p = new URLSearchParams()
    if (region) p.set('region', region)
    if (brand) p.set('brand', brand)
    if (soName) p.set('soName', soName)
    if (area) p.set('area', area)
    if (search) p.set('search', search)
    return p.toString()
  }, [region, brand, soName, area, search])

  useEffect(() => {
    fetch('/api/orders?mode=filters')
      .then(r => r.json())
      .then(d => setFilters(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const base = buildQS()
    const tableQS = base ? base + '&page=' + page + '&pageSize=' + pageSize : 'page=' + page + '&pageSize=' + pageSize

    Promise.all([
      fetch('/api/orders?mode=summary&' + base).then(r => r.json()),
      fetch('/api/orders?mode=charts&' + base).then(r => r.json()),
      fetch('/api/orders?mode=table&' + tableQS).then(r => r.json()),
    ])
      .then(([s, c, t]) => {
        setMetrics(s)
        setCharts(c)
        setOrders(t.data || [])
        setTotal(t.total || 0)
      })
      .catch(() => setError('Failed to load data. Check MongoDB connection.'))
      .finally(() => setLoading(false))
  }, [buildQS, page])

  const totalPages = Math.ceil(total / pageSize)

  const selCls = 'text-sm px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none'
  const btnCls = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">R</div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900">RHBL Order Dashboard</h1>
              <p className="text-xs text-gray-400">Live data from MongoDB</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className={selCls} value={region} onChange={e => { setRegion(e.target.value); setPage(0) }}>
              <option value="">All Regions</option>
              {filters && filters.regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={selCls} value={area} onChange={e => { setArea(e.target.value); setPage(0) }}>
              <option value="">All Areas</option>
              {filters && filters.areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select className={selCls} value={brand} onChange={e => { setBrand(e.target.value); setPage(0) }}>
              <option value="">All Brands</option>
              {filters && filters.brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className={selCls} value={soName} onChange={e => { setSoName(e.target.value); setPage(0) }}>
              <option value="">All SOs</option>
              {filters && filters.soNames.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(region || brand || soName || area || search) && (
              <button className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-sm text-red-500 hover:bg-red-50 cursor-pointer"
                onClick={() => { setRegion(''); setBrand(''); setSoName(''); setArea(''); setSearch(''); setPage(0) }}>
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

        {/* Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Order lines', value: metrics ? metrics.totalLines : '—', sub: '', color: '#3266ad' },
            { label: 'Total pcs', value: metrics ? metrics.totalPcs.toLocaleString() : '—', sub: 'Free: ' + (metrics ? metrics.totalFreePcs : 0), color: '#1d9e75' },
            { label: 'Gross TP', value: metrics ? fmtShort(metrics.totalGross) : '—', sub: '', color: '#1d9e75' },
            { label: 'Discount', value: metrics ? fmtShort(metrics.totalDiscount) : '—', sub: '', color: '#d85a30' },
            { label: 'Net TP', value: metrics ? fmtShort(metrics.totalNet) : '—', sub: '', color: '#534ab7' },
            { label: 'Outlets', value: metrics ? metrics.uniqueOutlets : '—', sub: (metrics ? metrics.uniqueSOs : 0) + ' SOs', color: '#993556' },
          ].map((m, i) => (
            <div key={i} style={{ borderLeft: '4px solid ' + m.color }} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{m.label}</p>
              <p className="text-xl font-semibold text-gray-900">{m.value}</p>
              {m.sub && <p className="text-xs text-gray-400 mt-1">{m.sub}</p>}
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading && !charts
            ? [1,2,3,4].map(i => <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />)
            : charts
              ? <>
                  <BarChart data={charts.byRegion} title="Net TP by Region" />
                  <BarChart data={charts.byBrand} title="Net TP by Brand" />
                  <BarChart data={charts.bySO} title="Top SOs by Net TP" />
                  <BarChart data={charts.byArea} title="Net TP by Area" />
                </>
              : null
          }
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-medium text-gray-800 flex-1">Order lines</h2>
            <input
              type="text"
              placeholder="Search outlet, SKU, SO, town…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="text-sm px-3 py-2 rounded-lg border border-gray-200 w-64 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No orders found</div>
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
                <tbody>
                  {orders.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">{row.OrderDate}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Region}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.Area}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.Town}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.SOName}</td>
                      <td className="px-3 py-2 max-w-[130px] truncate" title={row.OutletName}>{row.OutletName}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">{row.BrandName}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[150px] truncate text-gray-500" title={row.SKUName}>{row.SKUName}</td>
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

          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{total.toLocaleString()} rows{total > 0 ? ' · page ' + (page + 1) + ' of ' + totalPages : ''}</span>
            <div className="flex gap-1">
              <button className={btnCls} disabled={page === 0} onClick={() => setPage(0)}>««</button>
              <button className={btnCls} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</button>
              <button className={btnCls} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>›</button>
              <button className={btnCls} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»»</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
