'use client'

import { useEffect, useState, useCallback } from 'react'
import FilterBar from './FilterBar'
import { useFilters } from './useFilters'

interface DailyRow { date: string; grossTP: number; orders: number; pcs: number }
interface HourlyRow { hour: number; label: string; grossTP: number; orders: number }

function fmt(n: number) {
  const v = n || 0
  if (v >= 1000000) return '৳' + (v/1000000).toFixed(2) + 'M'
  if (v >= 1000)    return '৳' + (v/1000).toFixed(1) + 'K'
  return '৳' + v.toFixed(0)
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 2
  return (
    <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
      <div className="h-full rounded" style={{ width: pct + '%', background: color }} />
    </div>
  )
}

export default function TimeTrends({ subItem }: { subItem: string | null }) {
  const f = useFilters()
  const [daily,   setDaily]   = useState<DailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [view,    setView]    = useState<'daily' | 'weekly'>('daily')

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/trends?' + f.buildQS())
      .then(r => r.json())
      .then(d => { setDaily(Array.isArray(d?.daily) ? d.daily : []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [f.buildQS])

  useEffect(() => { load() }, [load])

  const maxGross = daily.length ? Math.max(...daily.map(d => d.grossTP)) : 1
  const maxOrders = daily.length ? Math.max(...daily.map(d => d.orders)) : 1

  // Weekly aggregation
  const weekly = daily.reduce((acc: Record<string, DailyRow>, row) => {
    const d = new Date(row.date)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const key = weekStart.toISOString().slice(0, 10)
    if (!acc[key]) acc[key] = { date: key, grossTP: 0, orders: 0, pcs: 0 }
    acc[key].grossTP += row.grossTP
    acc[key].orders  += row.orders
    acc[key].pcs     += row.pcs
    return acc
  }, {})
  const weeklyData = Object.values(weekly).sort((a, b) => a.date.localeCompare(b.date))

  const displayData = view === 'daily' ? daily : weeklyData
  const maxG = displayData.length ? Math.max(...displayData.map(d => d.grossTP)) : 1

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
            <h2 className="text-base font-semibold text-gray-900">Time-Series & Trend Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">Seasonality · Daily peaks · Weekly trends</p>
          </div>
          <div className="flex gap-2">
            {(['daily','weekly'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer capitalize transition-colors
                  ${view === v ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">⚠️ {error}</div>}

        {/* Summary cards */}
        {daily.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label:'Total days',   value: String(daily.length) },
              { label:'Total orders', value: daily.reduce((a,d)=>a+d.orders,0).toLocaleString() },
              { label:'Total pcs',    value: daily.reduce((a,d)=>a+d.pcs,0).toLocaleString() },
              { label:'Total gross',  value: fmt(daily.reduce((a,d)=>a+d.grossTP,0)) },
            ].map((m,i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <p className="text-lg font-semibold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-4">
            {view === 'daily' ? 'Daily' : 'Weekly'} Gross TP
          </h3>
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8 animate-pulse">Loading…</div>
          ) : displayData.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">No data</div>
          ) : (
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {displayData.map((row, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-24 shrink-0 text-gray-500 font-mono">{row.date}</span>
                  <MiniBar value={row.grossTP} max={maxG} color="#3266ad" />
                  <span className="w-20 text-right text-gray-600 shrink-0">{fmt(row.grossTP)}</span>
                  <span className="w-16 text-right text-gray-400 shrink-0">{row.orders} orders</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
