import { useAuth } from '@clerk/expo'
import { useCallback } from 'react'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'https://reptrack-five-tau.vercel.app').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

/**
 * Calls the RepTrack web API (Next.js on Vercel) with the Clerk session token —
 * the same endpoints the website uses, so data is shared with the trainer panel.
 */
export function useApi() {
  const { getToken } = useAuth()
  return useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await getToken()
    let res: Response
    try {
      res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.headers ?? {}),
        },
      })
    } catch {
      throw new ApiError(0, 'Brak połączenia z internetem.')
    }
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new ApiError(res.status, data?.error ?? `Błąd serwera (${res.status}).`)
    return data as T
  }, [getToken])
}
