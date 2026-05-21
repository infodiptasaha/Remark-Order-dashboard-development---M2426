import { useState, useCallback } from 'react'

export function useFilters() {
  const [region,    setRegion]    = useState('')
  const [area,      setArea]      = useState('')
  const [territory, setTerritory] = useState('')
  const [town,      setTown]      = useState('')
  const [soName,    setSoName]    = useState('')
  const [brand,     setBrand]     = useState('')
  const [dateFrom,  setDateFrom]  = useState('')
  const [dateTo,    setDateTo]    = useState('')

  const handleRegion    = (v: string) => { setRegion(v);    setArea(''); setTerritory(''); setTown(''); setSoName(''); setBrand('') }
  const handleArea      = (v: string) => { setArea(v);      setTerritory(''); setTown(''); setSoName(''); setBrand('') }
  const handleTerritory = (v: string) => { setTerritory(v); setTown(''); setSoName(''); setBrand('') }
  const handleTown      = (v: string) => { setTown(v);      setSoName(''); setBrand('') }
  const handleSO        = (v: string) => { setSoName(v);    setBrand('') }
  const handleBrand     = (v: string) => { setBrand(v) }
  const handleDateFrom  = (v: string) => { setDateFrom(v);  setArea(''); setTerritory(''); setTown(''); setSoName(''); setBrand('') }
  const handleDateTo    = (v: string) => { setDateTo(v) }
  const clearAll        = () => {
    setRegion(''); setArea(''); setTerritory(''); setTown('')
    setSoName(''); setBrand(''); setDateFrom(''); setDateTo('')
  }

  const buildQS = useCallback((extra?: Record<string, string>) => {
    const p = new URLSearchParams()
    if (region)    p.set('region',    region)
    if (area)      p.set('area',      area)
    if (territory) p.set('territory', territory)
    if (town)      p.set('town',      town)
    if (soName)    p.set('soName',    soName)
    if (brand)     p.set('brand',     brand)
    if (dateFrom)  p.set('dateFrom',  dateFrom)
    if (dateTo)    p.set('dateTo',    dateTo)
    if (extra) Object.entries(extra).forEach(([k, v]) => p.set(k, v))
    return p.toString()
  }, [region, area, territory, town, soName, brand, dateFrom, dateTo])

  return {
    region, area, territory, town, soName, brand, dateFrom, dateTo,
    handleRegion, handleArea, handleTerritory, handleTown,
    handleSO, handleBrand, handleDateFrom, handleDateTo,
    clearAll, buildQS
  }
}
