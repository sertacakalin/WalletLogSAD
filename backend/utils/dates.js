const isValidMonth = (m) => Number.isInteger(m) && m >= 1 && m <= 12;
const isValidYear  = (y) => Number.isInteger(y) && y >= 1900 && y <= 2999;

const monthRange = (month, year) => {
  const m = Number(month);
  const y = Number(year);
  if (!isValidMonth(m)) throw new Error('Invalid month');
  if (!isValidYear(y))  throw new Error('Invalid year');
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    startDate: `${y}-${mm}-01`,
    endDate:   `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
};

const isValidISODate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

const previousMonth = (month, year) => {
  const m = Number(month);
  const y = Number(year);
  if (!isValidMonth(m) || !isValidYear(y)) throw new Error('Invalid month/year');
  return m === 1 ? { month: 12, year: y - 1 } : { month: m - 1, year: y };
};

const advanceDate = (isoDate, frequency) => {
  if (!isValidISODate(isoDate)) throw new Error('Invalid date');
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (frequency === 'weekly')       date.setUTCDate(date.getUTCDate() + 7);
  else if (frequency === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else if (frequency === 'yearly')  date.setUTCFullYear(date.getUTCFullYear() + 1);
  else throw new Error('Invalid frequency');
  return date.toISOString().slice(0, 10);
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const daysBetween = (fromIso, toIso) => {
  if (!isValidISODate(fromIso) || !isValidISODate(toIso)) {
    throw new Error('Invalid date');
  }
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86400000);
};

module.exports = {
  isValidMonth,
  isValidYear,
  monthRange,
  isValidISODate,
  previousMonth,
  advanceDate,
  todayISO,
  daysBetween,
};
