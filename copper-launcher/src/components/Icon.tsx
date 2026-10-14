import type { CSSProperties } from 'react'
import { PxIcon } from './PxIcon'

export function Icon({
  id,
  className = 'icon',
  style,
}: {
  id: string
  className?: string
  style?: CSSProperties
}) {
  return <PxIcon name={id.replace(/^i-/, '')} className={className} style={style} />
}
