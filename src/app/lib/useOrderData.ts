import { useState, useCallback, useEffect, useRef } from 'react'

export interface Filters {
  region?: string; area?: string; territory?: string
  town?: string; soName?: string; brand?: string
  dateFrom?: string; dateTo?: string
}

export function currentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const last = new Date(y, now.getMonth() + 1, 0).getDate()
  return {
    from: `${y}-${m}-01`,
    to:   `${y}-${m}-${String(last).padStart(2, '0')}`,
    label: now.toLocaleString('en-BD', { month: 'long', year: 'numeric' })
  }
}

export function buildQS(filters: Filters, extra?: Record<string, string>) {
  const p = new URLSearchParams()
  if (filters.region)    p.set('region',    filters.region)
  if (filters.area)      p.set('area',      filters.area)
  if (filters.territory) p.set('territory', filters.territory)
  if (filters.town)      p.set('town',      filters.town)
  if (filters.soName)    p.set('soName',    filters.soName)
  if (filters.brand)     p.set('brand',     filters.brand)
  if (filters.dateFrom)  p.set('dateFrom',  filters.dateFrom)
  if (filters.dateTo)    p.set('dateTo',    filters.dateTo)
  if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v))
  return p.toString()
}

export function useAbortFetch() {
  const abortRef = useRef<AbortController | null>(null)
  const fetch2 = useCallback((url: string) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    return { ctrl, signal: ctrl.signal }
  }, [])
  return fetch2
}
