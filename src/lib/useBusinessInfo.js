import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { createBusinessInfoService } from '../services/businessInfo.js'

export const businessInfo = createBusinessInfoService(supabase)

// One request per page load, shared by the chat page, navbar and landing page.
let pending = null
export function loadCatalogOnce({ refresh = false } = {}) {
  if (!pending || refresh) pending = businessInfo.loadCatalog()
  return pending
}

/** Returns { catalog, loading }. `catalog` is null until the first load finishes. */
export function useBusinessInfo() {
  const [catalog, setCatalog] = useState(null)
  useEffect(() => {
    let alive = true
    loadCatalogOnce().then((c) => alive && setCatalog(c))
    return () => {
      alive = false
    }
  }, [])
  return { catalog, loading: catalog === null }
}

export const formatPeso = (n) => `PHP ${Number(n).toLocaleString('en-PH')}`
