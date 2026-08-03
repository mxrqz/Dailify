export const startOfMonthMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
export const endOfMonthMs = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
