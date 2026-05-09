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

module.exports = { isValidMonth, isValidYear, monthRange, isValidISODate };
