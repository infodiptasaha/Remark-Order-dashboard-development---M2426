'use client'

import { useEffect, useState, useCallback } from 'react'
import FilterBar from './FilterBar'
import { useFilters } from './useFilters'

interface RFMRow {
  outletCode: string; outletName: string; town: string; soName: string
  recency: number; frequency: number; monetary: number
  segment: string; clv: number; repeatRate: number
}

const SEGMENT_COLOR: Record<string, string> = {
  'Champions':      'bg-emerald-100 text-emerald-700',
  'Loyal':          'bg-blue-100 text-blue-700',
  'At Risk':        'bg-orange-100 text-orange-700',
  'Lost':           'bg-red-100 text-red-700',
  'New':            'bg-purple-100 text-purple-700',
  'Potential':      'bg-yellow-100 text-yellow-700',
}

function fmt(n: number) {
  return '৳' + (n || 0).toLocaleString('en-BD', { maximumFractionDigits: 0 })
}

export default function CustomerBehavior({ subItem }: { subItem: string | null }) {
  const f = useFilters()
  const [data,    setData]    = useState<RFMRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [sort,    setSort]    = useState<keyof RFMRow>('monetary')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/rfm?' + f.buildQS())
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [f.buildQS])

  useEffect(() => { load() }, [load])

  const sorted = [...data].sort((a, b) => {
    const av = a[sort], bv = b[sort]
    return typeof av === 'number' && typeof bv === 'number' ? bv - av : 0
  })

  const segments = data.reduce((acc, r) => {
    acc[r.segment] = (acc[r.segment] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const SortTh = ({ field, label }: { field: keyof RFMRow; label: string }) => (
    <th
      className={`px-3 py-2.5 text-left font-medium whitespace-nowrap cursor-pointer select-none
        ${sort === field ? 'text-blue-600' : 'text-gray-500'} hover:text-blue-500`}
      onClick={() => setSort(field)}
    >
      {label} {sort === field ? '↓' : ''}
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
      <main className="px-4 py-5 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Customer Behavior Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">RFM · CLV · Segmentation · Repeat Rate</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

        {/* Segment summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(segments).map(([seg, count]) => (
            <div key={seg} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{seg}</p>
              <p className="text-xl font-semibold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400 mt-1">outlets</p>
            </div>
          ))}
        </div>

        {/* RFM Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-800">RFM Analysis — click column to sort</h3>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Calculating…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Outlet Code</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Outlet</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Town</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">SO</th>
                    <SortTh field="recency"    label="Recency (days)" />
                    <SortTh field="frequency"  label="Frequency" />
                    <SortTh field="monetary"   label="Monetary (Gross)" />
                    <SortTh field="clv"        label="CLV" />
                    <SortTh field="repeatRate" label="Repeat %" />
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">Segment</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="px-3 py-2 font-mono text-gray-500">{row.outletCode}</td>
                      <td className="px-3 py-2 max-w-[130px] truncate" title={row.outletName}>{row.outletName}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.town}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-500">{row.soName}</td>
                      <td className="px-3 py-2 text-right">{row.recency}</td>
                      <td className="px-3 py-2 text-right font-medium">{row.frequency}</td>
                      <td className="px-3 py-2 text-right">{fmt(row.monetary)}</td>
                      <td className="px-3 py-2 text-right text-blue-600 font-medium">{fmt(row.clv)}</td>
                      <td className="px-3 py-2 text-right">{(row.repeatRate * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${SEGMENT_COLOR[row.segment] || 'bg-gray-100 text-gray-600'}`}>
                          {row.segment}
                        </span>
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
