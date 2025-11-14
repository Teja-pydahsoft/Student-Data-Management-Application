const buildHoliday = (date, localName, name, extra = {}) => ({
  date,
  localName,
  name,
  countryCode: 'IN',
  fixed: false,
  global: true,
  counties: null,
  launchYear: null,
  types: ['Public'],
  ...extra
});

const INDIA_2024 = [
  buildHoliday('2024-01-26', 'Republic Day', 'Republic Day of India'),
  buildHoliday('2024-03-08', 'Mahashivratri', 'Maha Shivaratri'),
  buildHoliday('2024-03-25', 'Holi', 'Holi'),
  buildHoliday('2024-03-29', 'Good Friday', 'Good Friday'),
  buildHoliday('2024-04-11', 'Eid al-Fitr', 'Id-ul-Fitr'),
  buildHoliday('2024-05-23', 'Buddha Purnima', 'Buddha Purnima'),
  buildHoliday('2024-08-15', 'Independence Day', 'Independence Day of India'),
  buildHoliday('2024-08-19', 'Raksha Bandhan', 'Raksha Bandhan'),
  buildHoliday('2024-10-02', 'Gandhi Jayanti', 'Mahatma Gandhi Jayanti'),
  buildHoliday('2024-10-12', 'Dussehra', 'Vijaya Dashami'),
  buildHoliday('2024-10-31', 'Diwali', 'Deepavali/Diwali'),
  buildHoliday('2024-11-01', 'Govardhan Puja', 'Govardhan Puja'),
  buildHoliday('2024-11-03', 'Bhai Dooj', 'Bhai Duj'),
  buildHoliday('2024-12-25', 'Christmas Day', 'Christmas Day')
];

const INDIA_2025 = [
  buildHoliday('2025-01-26', 'Republic Day', 'Republic Day of India'),
  buildHoliday('2025-03-01', 'Mahashivratri', 'Maha Shivaratri'),
  buildHoliday('2025-03-14', 'Holi', 'Holi'),
  buildHoliday('2025-04-18', 'Good Friday', 'Good Friday'),
  buildHoliday('2025-03-31', 'Eid al-Fitr', 'Id-ul-Fitr'),
  buildHoliday('2025-05-12', 'Buddha Purnima', 'Buddha Purnima'),
  buildHoliday('2025-06-06', 'Bakrid', 'Id-ul-Zuha (Bakrid)'),
  buildHoliday('2025-08-15', 'Independence Day', 'Independence Day of India'),
  buildHoliday('2025-08-19', 'Janmashtami', 'Janmashtami'),
  buildHoliday('2025-10-02', 'Gandhi Jayanti', 'Mahatma Gandhi Jayanti'),
  buildHoliday('2025-10-02', 'Navaratri Begins', 'Navaratri'),
  buildHoliday('2025-10-21', 'Diwali', 'Deepavali/Diwali'),
  buildHoliday('2025-10-22', 'Govardhan Puja', 'Govardhan Puja'),
  buildHoliday('2025-10-23', 'Bhai Dooj', 'Bhai Duj'),
  buildHoliday('2025-11-01', 'Guru Nanak Jayanti', 'Guru Nanak Jayanti'),
  buildHoliday('2025-12-25', 'Christmas Day', 'Christmas Day')
];

const FALLBACKS = {
  IN: {
    2024: INDIA_2024,
    2025: INDIA_2025
  }
};

const getFallbackHolidays = (countryCode, year) => {
  if (!countryCode || !year) return [];
  const countryFallback = FALLBACKS[countryCode.toUpperCase()];
  if (!countryFallback) return [];
  return countryFallback[year] || [];
};

module.exports = {
  getFallbackHolidays
};

