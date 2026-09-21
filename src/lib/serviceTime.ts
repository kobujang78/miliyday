const DAY_MS = 86_400_000

/** Military service dates are interpreted at 08:00 in Korea (UTC+09:00). */
export function calculateServiceTime(enlistDate: string, serviceMonths: number, now: Date) {
  const [year, month, day] = enlistDate.split('-').map(Number)
  const dischargeDay = new Date(Date.UTC(year, month - 1 + serviceMonths, day))
  const dischargeDate = dischargeDay.toISOString().slice(0, 10)
  const startMs = new Date(`${enlistDate}T08:00:00+09:00`).getTime()
  const endMs = new Date(`${dischargeDate}T08:00:00+09:00`).getTime()
  const totalMs = endMs - startMs
  const elapsedMs = Math.min(totalMs, Math.max(0, now.getTime() - startMs))
  const remainingMs = totalMs - elapsedMs

  return {
    dischargeDate,
    totalMs,
    elapsedMs,
    remainingMs,
    totalDays: totalMs / DAY_MS,
    remainingDays: Math.ceil(remainingMs / DAY_MS),
    percent: Math.round((elapsedMs / totalMs) * 1000) / 10,
  }
}

export function formatElapsedTime(elapsedMs: number) {
  const tenths = Math.floor(elapsedMs / 100)
  const days = Math.floor(tenths / 864_000)
  const hours = Math.floor((tenths % 864_000) / 36_000)
  const minutes = Math.floor((tenths % 36_000) / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  const tenth = tenths % 10
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${days}일 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${tenth}`
}
