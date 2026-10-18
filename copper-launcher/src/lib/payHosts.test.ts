import { expect, test } from 'bun:test'
import { isPaymentUrl } from './payHosts'

test('в Copper оплаты нет: ни одна ссылка не считается платёжной', () => {
  expect(isPaymentUrl('https://gate.antilopay.com/pay/x')).toBe(false)
  expect(isPaymentUrl('https://pay.enot.io/inv-1')).toBe(false)
  expect(isPaymentUrl('https://copper.net/profile#plus')).toBe(false)
  expect(isPaymentUrl('javascript:alert(1)')).toBe(false)
  expect(isPaymentUrl(null)).toBe(false)
})
