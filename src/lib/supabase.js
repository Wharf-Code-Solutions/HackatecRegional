import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// Variables VITE_* que faltan en el build (se fijan al compilar, no en ejecución).
export const variablesFaltantes = [
  !url && 'VITE_SUPABASE_URL',
  !key && 'VITE_SUPABASE_KEY',
].filter(Boolean)

// Si faltan, no se crea el cliente: createClient lanzaría excepción y dejaría la página en blanco.
export const supabase = variablesFaltantes.length ? null : createClient(url, key)
