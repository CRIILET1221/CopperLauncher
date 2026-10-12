export type PurchaseReason = 'cancel' | 'insufficient' | 'error' | 'checkout' | 'signin'
export function purchaseFlow(_product: string, _id: string, _price?: number, _cur?: 'rubies' | 'shards' | 'kopecks') {
  return (_ok: boolean, _reason?: PurchaseReason, _err?: unknown): void => {}
}
