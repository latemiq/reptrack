// Calendar days of the app's users. The server runs in UTC, so its own getDay() / setHours() give the
// wrong day and week for the first hour or two after Polish midnight. Use these in API routes instead.

const DAY = 86400000
const HOUR = 3600000

const FORMAT = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' })

/** The date in Poland at the given instant, as YYYY-MM-DD. */
export function appDate(at: Date | number): string {
  const parts = FORMAT.formatToParts(at)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** Whole days between two YYYY-MM-DD dates. */
export const dateDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)

/** 0 = Monday … 6 = Sunday, in Poland. */
export const appWeekday = (at: Date | number) => (new Date(appDate(at)).getUTCDay() + 6) % 7

/** The instant of Monday 00:00 in Poland for the week containing `at`, moved by `offset` weeks. */
export function appMonday(at: Date | number, offset = 0): Date {
  const monday = new Date(Date.parse(appDate(at)) + (offset * 7 - appWeekday(at)) * DAY)
  // Midnight in Poland is 22:00 UTC in summer and 23:00 UTC in winter.
  const summer = monday.getTime() - 2 * HOUR
  return new Date(appDate(summer) === monday.toISOString().slice(0, 10) ? summer : monday.getTime() - HOUR)
}
