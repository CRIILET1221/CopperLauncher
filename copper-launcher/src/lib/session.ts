import { refreshPlayStats } from '../state/playStats'
import { refreshProfiles } from '../state/profiles'
import { useUi } from '../state/ui'
import { playSound } from './sound'

export function enterApp() {
  playSound('login')
  useUi.getState().setLogged(true)
  void refreshProfiles()
  void refreshPlayStats()
}
