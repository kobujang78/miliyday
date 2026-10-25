import { test, expect } from '@playwright/test'
import { calcAutoRank, getPromotionDates, PROMOTION_MONTHS } from '@/lib/rankUtils'
import { SERVICE_MONTHS } from '@/components/RankIcon'
import { calcMonthlySalaries, calcTotalSalary, calcSavings, SALARY_BY_RANK, SAVINGS } from '@/lib/salaryUtils'
import { daysBetweenInclusive, calcUsedDays, nextVacationDDay, type VacationRecord } from '@/lib/vacationUtils'

// 브라우저를 띄우지 않는 순수 함수 테스트. page 픽스처를 쓰지 않으므로 크롬은 기동되지 않는다.

// ── 복무기간 상수 ──────────────────────────────────────────────
test('복무기간이 군종별 현행 기준과 일치한다', () => {
  expect(SERVICE_MONTHS.army).toBe(18)
  expect(SERVICE_MONTHS.marines).toBe(18)
  expect(SERVICE_MONTHS.katusa).toBe(18)
  expect(SERVICE_MONTHS.navy).toBe(20)
  expect(SERVICE_MONTHS.airforce).toBe(21)
})

// ── 진급 계산 ─────────────────────────────────────────────────
// 오늘 날짜에 의존하지 않도록 "N개월 전 입대" 형태로 입력을 만든다.
function enlistedMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  d.setDate(1) // 말일 → 월말 롤오버 문제 회피
  return d.toISOString().slice(0, 10)
}

test('calcAutoRank: 경과 개월수에 따라 이병→일병→상병→병장', () => {
  expect(calcAutoRank(enlistedMonthsAgo(0), 'army')).toBe(1)
  expect(calcAutoRank(enlistedMonthsAgo(1), 'army')).toBe(1)
  expect(calcAutoRank(enlistedMonthsAgo(2), 'army')).toBe(2)   // 일병 2개월
  expect(calcAutoRank(enlistedMonthsAgo(7), 'army')).toBe(2)
  expect(calcAutoRank(enlistedMonthsAgo(8), 'army')).toBe(3)   // 상병 8개월
  expect(calcAutoRank(enlistedMonthsAgo(13), 'army')).toBe(3)
  expect(calcAutoRank(enlistedMonthsAgo(14), 'army')).toBe(4)  // 병장 14개월
  expect(calcAutoRank(enlistedMonthsAgo(30), 'army')).toBe(4)
})

test('calcAutoRank: 입대일 미입력/미래 입대일은 이병', () => {
  expect(calcAutoRank('', 'army')).toBe(1)
  const future = new Date(); future.setMonth(future.getMonth() + 3)
  expect(calcAutoRank(future.toISOString().slice(0, 10), 'army')).toBe(1)
})

test('getPromotionDates: 입대일 기준 상대 개월로 산출된다', () => {
  const d = getPromotionDates('2026-03-15', 'army')!
  expect(d.private2.toISOString().slice(0, 10)).toBe('2026-03-15')
  expect(d.private1.toISOString().slice(0, 10)).toBe('2026-05-15')  // +2
  expect(d.corporal.toISOString().slice(0, 10)).toBe('2026-11-15')  // +8
  expect(d.sergeant.toISOString().slice(0, 10)).toBe('2027-05-15')  // +14
  expect(getPromotionDates('', 'army')).toBeNull()
})

test('진급 기준은 현재 전 군종 동일하다 (달라지면 이 테스트부터 고칠 것)', () => {
  const base = PROMOTION_MONTHS.army
  for (const b of ['navy', 'airforce', 'marines', 'katusa'] as const) {
    expect(PROMOTION_MONTHS[b]).toEqual(base)
  }
})

// ── 월급 ──────────────────────────────────────────────────────
test('calcMonthlySalaries: 복무 개월수만큼 생성되고 계급별 월급이 매핑된다', () => {
  const rows = calcMonthlySalaries('2026-03-15', 'army')
  expect(rows).toHaveLength(SERVICE_MONTHS.army)
  expect(rows[0].rank).toBe(1)
  expect(rows[0].salary).toBe(SALARY_BY_RANK[1])
  expect(rows[2].rank).toBe(2)   // 2개월차 일병
  expect(rows[8].rank).toBe(3)   // 8개월차 상병
  expect(rows[14].rank).toBe(4)  // 14개월차 병장
  expect(rows.at(-1)!.rank).toBe(4)
})

test('calcTotalSalary: 육군 18개월 총 월급 (2026년 기준 단가)', () => {
  const total = calcTotalSalary(calcMonthlySalaries('2026-03-15', 'army'))
  // 이병 2 + 일병 6 + 상병 6 + 병장 4
  const expected = 750000 * 2 + 960000 * 6 + 1200000 * 6 + 1500000 * 4
  expect(total).toBe(expected)
})

test('calcMonthlySalaries: 입대일 없으면 빈 배열', () => {
  expect(calcMonthlySalaries('', 'army')).toEqual([])
})

// ── 장병내일준비적금 ────────────────────────────────────────────
test('calcSavings: 원금과 정부 매칭지원금은 1:1이다', () => {
  const r = calcSavings(500000, 18)
  expect(r.totalPrincipal).toBe(500000 * 18)
  expect(r.matchingAmount).toBe(r.totalPrincipal * SAVINGS.MATCHING_RATIO)
  expect(r.totalAmount).toBe(r.totalPrincipal + r.matchingAmount + r.interest)
})

// ⚠️ 현재 구현은 "정부 매칭지원금에도 원금과 동일한 이자를 가산"한다.
// 실제 장병내일준비적금의 매칭지원금은 만기에 지급되어 이자가 붙지 않는 것이 일반적이므로,
// 아래 값은 만기 수령액을 과대 표시할 가능성이 있다.
// 이 테스트는 "현재 동작"을 고정해 두어, 계산식을 고칠 때 반드시 이 테스트가 깨지도록 한다.
// 공식 기준으로 재검증한 뒤 기대값을 갱신할 것. (개선 계획서 §4.7)
test('calcSavings: 이자에 매칭지원금분이 이중 계상되어 있다 (재검증 필요)', () => {
  const monthly = 500000, months = 18
  const r = calcSavings(monthly, months)

  // 본인 원금에 대한 단리 이자만 계산했을 때의 값
  let principalOnly = 0
  for (let m = 0; m < months; m++) {
    principalOnly += monthly * (SAVINGS.BASE_RATE / 12) * (months - m)
  }

  // 현재 구현의 이자는 정확히 그 2배 (매칭분 이자가 더해져 있음)
  expect(r.interest).toBe(Math.round(principalOnly * 2))
})

// ── 휴가 ──────────────────────────────────────────────────────
test('daysBetweenInclusive: 시작일과 종료일을 모두 포함한다', () => {
  expect(daysBetweenInclusive('2026-08-01', '2026-08-01')).toBe(1)
  expect(daysBetweenInclusive('2026-08-01', '2026-08-03')).toBe(3)
  expect(daysBetweenInclusive('2026-08-30', '2026-09-02')).toBe(4) // 월 경계
})

test('calcUsedDays: 휴가 종류별로 합산된다', () => {
  const recs: VacationRecord[] = [
    { id: '1', type: 'regular', title: 'a', startDate: '2026-08-01', endDate: '2026-08-03', days: 3 },
    { id: '2', type: 'regular', title: 'b', startDate: '2026-09-01', endDate: '2026-09-02', days: 2 },
    { id: '3', type: 'reward', title: 'c', startDate: '2026-10-01', endDate: '2026-10-04', days: 4 },
  ]
  const used = calcUsedDays(recs)
  expect(used.regular).toBe(5)
  expect(used.reward).toBe(4)
  expect(used.consolation).toBe(0)
})

test('nextVacationDDay: 미래 휴가 중 가장 가까운 것을 고른다', () => {
  const mk = (id: string, daysFromNow: number): VacationRecord => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + daysFromNow)
    const s = d.toISOString().slice(0, 10)
    return { id, type: 'regular', title: id, startDate: s, endDate: s, days: 1 }
  }
  const next = nextVacationDDay([mk('far', 30), mk('near', 7), mk('past', -5)])
  expect(next?.record.id).toBe('near')
  expect(next?.days).toBe(7)

  expect(nextVacationDDay([])).toBeNull()
  expect(nextVacationDDay([mk('past', -1)])).toBeNull()
})
