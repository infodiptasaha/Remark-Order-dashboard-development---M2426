'use client'

import { useEffect, useState, useCallback } from 'react'
import FilterBar from './FilterBar'
import { useFilters } from './useFilters'

interface GeoRow {
  region: string; area: string; territory: string; town: string
  grossTP: number; orders: number; outlets: number; pcs: number
  avgPerOutlet: number
}

function fmt(n: number) {
  const v = n || 0
  if (v >= 1000000) return '৳' + (v/1000000).toFixed(2) + 'M'
  if (v >= 1000)    return '৳' + (v/1000).toFixed(1) + 'K'
  return '৳' + v.toFixed(0)
}

const HEAT = ['#f0f9ff','#bae6fd','#7dd3fc','#38bdf8','#0ea5e9','#0284c7','#0369a1','#075985']

export default function Geographic({ subItem }: { subItem: string | null }) {
  const f = useFilters()
  const [data,    setData]    = useState<GeoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [groupBy, setGroupBy] = useState<'region'|'area'|'territory'|'town'>('region')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/geographic?' + f.buildQS() + '&groupBy=' + groupBy)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [f.buildQS, groupBy])

  useEffect(() => { load() }, [load])

  const maxGross = data.length ? Math.max(...data.map(d => d.grossTP)) : 1

  const heatColor = (val: number) => {
    const idx = Math.min(Math.floor((val / maxGross) * (HEAT.length - 1)), HEAT.length - 1)
    return HEAT[idx]
  }

  const labelMap = { region:'Region', area:'Area', territory:'Territory', town:'Town' }

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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Geographic Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">Hotspots · Coldspots · Product-location fit · Heatmap</p>
          </div>
          <div className="flex gap-1.5">
            {(['region','area','territory','town'] as const).map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer capitalize transition-colors
                  ${groupBy === g ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {labelMap[g]}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

        {/* Heatmap grid */}
        {!loading && data.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Heatmap — Gross TP intensity</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {data.map((row, i) => (
                <div key={i}
                  className="rounded-lg p-3 border border-gray-100 transition-all hover:scale-105"
                  style={{ background: heatColor(row.grossTP) }}>
                  <p className="text-xs font-medium text-gray-800 truncate"
                    title={row[groupBy]}>{row[groupBy]}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{fmt(row.grossTP)}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{row.outlets} outlets · {row.orders} orders</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500">Ranked by Gross TP — darker = higher value</p>
          </div>
          {loading ? (
            <div className="p-10 text-center text-gray-400 text-sm animate-pulse">Loading…</div>
          ) : data.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">No data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">#</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium">{labelMap[groupBy]}</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Gross TP</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Orders</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Outlets</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Pcs</th>
                    <th className="px-3 py-2.5 text-right text-gray-500 font-medium">Avg/Outlet</th>
                    <th className="px-3 py-2.5 text-left text-gray-500 font-medium w-32">Intensity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-blue-50/30">
                      <td className="px-3 py-2 text-gray-400">{i+1}</td>
                      <td className="px-3 py-2 font-medium max-w-[150px] truncate">{row[groupBy]}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(row.grossTP)}</td>
                      <td className="px-3 py-2 text-right">{row.orders.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">{row.outlets}</td>
                      <td className="px-3 py-2 text-right">{row.pcs.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{fmt(row.avgPerOutlet)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 bg-gray-100 rounded h-3 overflow-hidden">
                            <div className="h-full rounded"
                              style={{ width: Math.max((row.grossTP/maxGross)*100,2)+'%', background:'#3266ad' }} />
                          </div>
                          <span className="text-[10px] text-gray-400 w-8 text-right">
                            {Math.round((row.grossTP/maxGross)*100)}%
                          </span>
                        </div>
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
