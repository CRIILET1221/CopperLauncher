export type SoundEvent =
  | 'click'
  | 'nav'
  | 'toggle'
  | 'open'
  | 'close'
  | 'notify'
  | 'success'
  | 'install'
  | 'achievement'
  | 'error'
  | 'delete'
  | 'login'
  | 'launch'
  | 'crash'
  | 'chest_hit'
  | 'chest_crack'
  | 'chest_open'
  | 'chest_card'
  | 'chest_rare'
  | 'chest_epic'
  | 'chest_gold'
  | 'case_burst'
export type SoundMode = 'off' | 'notify' | 'all'
// Compatibility API for existing button handlers. Copper has no audio player.
export const soundMode = (): SoundMode => 'off'
export const setSoundMode = (_mode: SoundMode) => {}
export const soundEnabled = () => false
export const uiClicksEnabled = () => false
export const soundVolume = () => 0
export const playSound = (_event: SoundEvent) => {}
export const playNotifySound = () => {}
export const playSample = (_event: SoundEvent, _rate = 1) => {}
export const fetchSounds = async () => 0
export const initSounds = () => {}
export const isPrimaryPress = (event: { button: number; isPrimary: boolean }) => event.button === 0 && event.isPrimary
export const soundAllowed = (_event: SoundEvent, _mode: SoundMode, _gestureActive: boolean) => false
