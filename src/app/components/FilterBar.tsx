'use client'

import { useEffect, useState, useCallback } from 'react'

interface GeoFilters {
  regions: string[]; areas: string[]; territories: string[]; towns: string[]
}
interface OrderFilters { soNames: string[]; brands: string[] }

interface Props {
  region: string; area: string; territory: string; town: string
  soName: string; brand: string; dateFrom: string; dateTo: string
  onRegion: (v: string) => void; onArea: (v: string) => void
  onTerritory: (v: string) => void; onTown: (v: string) => void
  onSO: (v: string) => void; onBrand: (v: string) => void
  onDateFrom: (v: string) => void; onDateTo: (v: string) => void
  onClear: () => void
}

export default function FilterBar(props: Props) {
  const { region, area, territory, town, soName, brand, dateFrom, dateTo } = props

  const [geo, setGeo] = useState<GeoFilters>({ regions:[], areas:[], territories:[], towns:[] })
  const [of,  setOf]  = useState<OrderFilters>({ soNames:[], brands:[] })

  const geoQS = useCallback(() => {
    const p = new URLSearchParams()
    if (region)    p.set('region',    region)
    if (area)      p.set('area',      area)
    if (territory) p.set('territory', territory)
    if (dateFrom)  p.set('dateFrom',  dateFrom)
    if (dateTo)    p.set('dateTo',    dateTo)
    return p.toString()
  }, [region, area, territory, dateFrom, dateTo])

  const orderQS = useCallback(() => {
    const p = new URLSearchParams()
    if (region)    p.set('region',    region)
    if (area)      p.set('area',      area)
    if (territory) p.set('territory', territory)
    if (town)      p.set('town',      town)
    if (soName)    p.set('soName',    soName)
    if (brand)     p.set('brand',     brand)
    if (dateFrom)  p.set('dateFrom',  dateFrom)
    if (dateTo)    p.set('dateTo',    dateTo)
    return p.toString()
  }, [region, area, territory, town, soName, brand, dateFrom, dateTo])

  useEffect(() => {
    fetch('/api/geo?' + geoQS())
      .then(r => r.json())
      .then((d: GeoFilters) => setGeo({
        regions:     Array.isArray(d?.regions)     ? d.regions     : [],
        areas:       Array.isArray(d?.areas)       ? d.areas       : [],
        territories: Array.isArray(d?.territories) ? d.territories : [],
        towns:       Array.isArray(d?.towns)       ? d.towns       : [],
      }))
      .catch(() => {})
  }, [geoQS])

  useEffect(() => {
    fetch('/api/orders?mode=filters&' + orderQS())
      .then(r => r.json())
      .then((d: OrderFilters) => setOf({
        soNames: Array.isArray(d?.soNames) ? d.soNames : [],
        brands:  Array.isArray(d?.brands)  ? d.brands  : [],
      }))
      .catch(() => {})
  }, [orderQS])

  const sel = 'text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 cursor-pointer focus:outline-none hover:border-blue-400 transition-colors min-w-0'
  const date = 'text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700 focus:outline-none cursor-pointer w-32'
  const hasFilters = region || area || territory || town || soName || brand || dateFrom || dateTo

  const cm = new Date()
  const defaultLabel = cm.toLocaleString('en-BD', { month: 'long', year: 'numeric' })
  const dateLabel = (dateFrom || dateTo) ? (dateFrom || '…') + ' → ' + (dateTo || '…') : defaultLabel

  return (
    <div className="px-4 py-2.5 bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] text-gray-400">
          Showing: <span className="text-blue-600 font-medium">{dateLabel}</span>
        </p>
        <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 shrink-0">
          <span className="text-xs text-gray-400">From</span>
          <input type="date" className={date} value={dateFrom}
            onChange={e => { props.onDateFrom(e.target.value) }} />
          <span className="text-xs text-gray-400">To</span>
          <input type="date" className={date} value={dateTo}
            onChange={e => props.onDateTo(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <select className={sel} value={region}    onChange={e => props.onRegion(e.target.value)}    style={{flex:'1 1 90px'}}>
          <option value="">All Regions</option>
          {geo.regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-gray-300 text-xs shrink-0">›</span>
        <select className={sel} value={area}      onChange={e => props.onArea(e.target.value)}      style={{flex:'1 1 90px'}}>
          <option value="">All Areas</option>
          {geo.areas.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span className="text-gray-300 text-xs shrink-0">›</span>
        <select className={sel} value={territory} onChange={e => props.onTerritory(e.target.value)} style={{flex:'1 1 100px'}}>
          <option value="">All Territories</option>
          {geo.territories.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-gray-300 text-xs shrink-0">›</span>
        <select className={sel} value={town}      onChange={e => props.onTown(e.target.value)}      style={{flex:'1 1 90px'}}>
          <option value="">All Towns</option>
          {geo.towns.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-gray-300 text-xs shrink-0">›</span>
        <select className={sel} value={soName}    onChange={e => props.onSO(e.target.value)}        style={{flex:'1 1 110px'}}>
          <option value="">All SOs</option>
          {of.soNames.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-gray-300 text-xs shrink-0">›</span>
        <select className={sel} value={brand}     onChange={e => props.onBrand(e.target.value)}     style={{flex:'1 1 90px'}}>
          <option value="">All Brands</option>
          {of.brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        {hasFilters && (
          <button onClick={props.onClear}
            className="shrink-0 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-xs text-red-500 hover:bg-red-50 cursor-pointer whitespace-nowrap">
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  )
}
