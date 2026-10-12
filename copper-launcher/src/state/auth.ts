import { create } from 'zustand'
import { hasCopperAccount } from '../lib/api'
import { SECRETS_CHANGED_EVENT } from '../lib/secure'

interface AuthState {
  copper: boolean
  sync: () => void
}

export const useAuth = create<AuthState>((set) => ({
  copper: hasCopperAccount(),
  sync: () => {
    const copper = hasCopperAccount()
    set((s) => (s.copper === copper ? s : { ...s, copper }))
  },
}))

export const syncAuth = () => useAuth.getState().sync()

export const useHasCopper = () => useAuth((s) => s.copper)

if (typeof window !== 'undefined') window.addEventListener(SECRETS_CHANGED_EVENT, syncAuth)
