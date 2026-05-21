'use client'

import { useEffect, useState, useCallback } from 'react'
import FilterBar from './FilterBar'
import { useFilters } from './useFilters'

interface ProductRow {
  skuCode: string; skuName: string; brand: string
  orderPcs: number; grossTP: number; netTP: number
  outletCount: number; orderCount: number; avgOrderValue: number
}

function fmt(n: number) {
  return '৳' + (n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })
}

export default function ProductSales({ subItem }: { subItem: string | null }) {
  const f = useFilters()
  const [data,    setData]    = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [view,    setView]    = useState<'top' | 'bottom'>('top')
  const [sort,    setSort]    = useState<keyof ProductRow>('grossTP')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/products?' + f.buildQS())
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [f.buildQS])

  useEffect(() => { load() }, [load])

  const sorted = [...data].sort((a, b) => {
    const av = a[sort], bv = b[sort]
    if (typeof av === 'number' && typeof bv === 'number') return view === 'top' ? bv - av : av - bv
    return 0
  }).slice(0, 50)

  const SortTh = ({ field, label }: { field: keyof ProductRow; label: string }) => (
    <th className={`px-3 py-2.5 text-right font-medium whitespace-nowrap cursor-pointer select-none
      ${sort === field ? 'text-blue-600' : 'text-gray-500'} hover:text-blue-500`}
      onClick={() => setSort(field)}>
      {label} {sort === field ? (view === 'top' ? '↓' : '↑') : ''}
    </th>
  )

  return (
    <div className="min-h-full bg-gray-50">
      <FilterBar
        region={f.region} area={f.area} territory={f.territory} town={f.town}
        soName={f.soName} brand={f.brand} dateFrom={f.dateFrom} dateTo={f.dateTo}
        onRegion={f.handleRegion} onArea={f.handleArea} onTerritory={f.handleTerritory}
        onTown={f.handleTown} onSO={f.handleSO} onBrand={f.handleBrand}
        onDateFrom={f.handleDateFrom} onDateTo={f.handleDateTo} onClear={f.clearAll}
      />
      <main className="px-4 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Product & Sales Performance</h2>
            <p className="text-xs text-gray-400 mt-0.5">Top & bottom products · Market basket</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setView('top')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
                ${view === 'top' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              Top 50
            </button>
            <button onClick={() => setView('bottom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
                ${view === 'bottom' ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              Bottom 50
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Showing {view === 'top' ? 'best' : 'worst'} 50 SKUs by selected metric — click column header to re-rank</p>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Loading products…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">Brand</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">SKU</th>
                    <SortTh field="orderPcs"      label="Pcs" />
                    <SortTh field="orderCount"    label="Orders" />
                    <SortTh field="outletCount"   label="Outlets" />
                    <SortTh field="grossTP"       label="Gross TP" />
                    <SortTh field="netTP"         label="Net TP" />
                    <SortTh field="avgOrderValue" label="Avg Order" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600 whitespace-nowrap">{row.brand}</span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-gray-700" title={row.skuName}>{row.skuName}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.orderPcs.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{row.orderCount}</td>
                      <td className="px-3 py-2 text-right">{row.outletCount}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{fmt(row.grossTP)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(row.netTP)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(row.avgOrderValue)}</td>
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
