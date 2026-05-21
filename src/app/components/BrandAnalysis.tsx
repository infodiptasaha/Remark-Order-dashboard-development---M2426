'use client'

import { useEffect, useState, useCallback } from 'react'
import FilterBar from './FilterBar'
import { useFilters } from './useFilters'

interface BrandRow {
  brand: string
  grossTP: number; netTP: number; orders: number; pcs: number
  outlets: number; avgOrderValue: number
  prevGrossTP: number; growthRate: number
  repeatOutlets: number; repeatRate: number
  avgRepeatVelocityDays: number
}

function fmt(n: number) {
  const v = n || 0
  if (v >= 1000000) return '৳' + (v/1000000).toFixed(2) + 'M'
  if (v >= 1000)    return '৳' + (v/1000).toFixed(1) + 'K'
  return '৳' + v.toFixed(0)
}

function GrowthBadge({ rate }: { rate: number }) {
  if (rate === 0) return <span className="text-gray-400 text-[10px]">—</span>
  const color = rate > 0 ? 'text-emerald-600' : 'text-red-500'
  return <span className={`text-[11px] font-medium ${color}`}>{rate > 0 ? '+' : ''}{rate.toFixed(1)}%</span>
}

export default function BrandAnalysis({ subItem }: { subItem: string | null }) {
  const f = useFilters()
  const [data,    setData]    = useState<BrandRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [sort,    setSort]    = useState<keyof BrandRow>('grossTP')
  const [sortDir, setSortDir] = useState<'desc'|'asc'>('desc')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/brands?' + f.buildQS())
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [f.buildQS])

  useEffect(() => { load() }, [load])

  const handleSort = (field: keyof BrandRow) => {
    if (sort === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(field); setSortDir('desc') }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sort], bv = b[sort]
    if (typeof av === 'number' && typeof bv === 'number')
      return sortDir === 'desc' ? bv - av : av - bv
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
    return 0
  })

  const SortTh = ({ field, label, right = true }: { field: keyof BrandRow; label: string; right?: boolean }) => (
    <th className={`px-3 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none
      ${right ? 'text-right' : 'text-left'}
      ${sort === field ? 'text-blue-600' : 'text-gray-500'} hover:text-blue-500`}
      onClick={() => handleSort(field)}>
      {label} {sort === field ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  )

  const totalGross = data.reduce((a,r) => a+r.grossTP, 0)
  const maxGross   = data.length ? Math.max(...data.map(r => r.grossTP)) : 1

  return (
    <div className="min-h-full bg-gray-50">
      <FilterBar
        region={f.region} area={f.area} territory={f.territory} town={f.town}
        soName={f.soName} brand={f.brand} dateFrom={f.dateFrom} dateTo={f.dateTo}
        onRegion={f.handleRegion} onArea={f.handleArea} onTerritory={f.handleTerritory}
        onTown={f.handleTown} onSO={f.handleSO} onBrand={f.handleBrand}
        onDateFrom={f.handleDateFrom} onDateTo={f.handleDateTo} onClear={f.clearAll}
      />
      <main className="px-4 py-5 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Brand Analysis</h2>
          <p className="text-xs text-gray-400 mt-0.5">Performance · Growth · Repeat · Affinity · AOV · Velocity · Churn</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

        {/* Brand share visual */}
        {!loading && data.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Brand share — Gross TP</h3>
            <div className="space-y-2">
              {data.slice(0, 10).map((row, i) => {
                const share = totalGross > 0 ? (row.grossTP / totalGross) * 100 : 0
                const colors = ['#3266ad','#1d9e75','#d85a30','#ba7517','#993556','#534ab7','#0f6e56','#639922','#c0392b','#8e44ad']
                return (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="w-20 shrink-0 font-medium truncate text-gray-700">{row.brand}</span>
                    <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                      <div className="h-full rounded flex items-center px-1.5 text-white text-[10px] font-medium"
                        style={{ width: Math.max(share, 1) + '%', background: colors[i % colors.length] }}>
                        {share > 5 ? share.toFixed(1) + '%' : ''}
                      </div>
                    </div>
                    <span className="w-12 text-right text-gray-400 shrink-0">{share.toFixed(1)}%</span>
                    <span className="w-20 text-right text-gray-600 shrink-0">{fmt(row.grossTP)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Full table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Click any column header to sort</p>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Loading brands…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">#</th>
                    <SortTh field="brand"                label="Brand"        right={false} />
                    <SortTh field="grossTP"              label="Gross TP" />
                    <SortTh field="netTP"                label="Net TP" />
                    <SortTh field="orders"               label="Orders" />
                    <SortTh field="pcs"                  label="Pcs" />
                    <SortTh field="outlets"              label="Outlets" />
                    <SortTh field="avgOrderValue"        label="Avg Order" />
                    <SortTh field="growthRate"           label="Growth %" />
                    <SortTh field="repeatRate"           label="Repeat %" />
                    <SortTh field="avgRepeatVelocityDays" label="Velocity (days)" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="px-3 py-2 text-gray-400">{i+1}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{row.brand}</td>
                      <td className="px-3 py-2 text-right font-medium">{fmt(row.grossTP)}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmt(row.netTP)}</td>
                      <td className="px-3 py-2 text-right">{row.orders.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{row.pcs.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{row.outlets}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(row.avgOrderValue)}</td>
                      <td className="px-3 py-2 text-right"><GrowthBadge rate={row.growthRate} /></td>
                      <td className="px-3 py-2 text-right">
                        <span className={row.repeatRate > 0.5 ? 'text-emerald-600 font-medium' : 'text-gray-600'}>
                          {(row.repeatRate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {row.avgRepeatVelocityDays > 0 ? row.avgRepeatVelocityDays.toFixed(0) + 'd' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
