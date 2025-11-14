const https = require('https');
const zlib = require('zlib');
const { createCache } = require('./cache');
const { getFallbackHolidays } = require('../constants/holidayFallbacks');

const HOLIDAY_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
const holidayCache = createCache(HOLIDAY_CACHE_TTL);

const parseJsonSafely = (payload, url) => {
  if (!payload || payload.trim().length === 0) {
    // Treat empty body as "no holidays available" instead of throwing, but log context.
    return [];
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    throw new Error(
      `Failed to parse holiday API response for ${url}: ${error.message}`
    );
  }
};

const fetchJsonLegacy = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        timeout: options.timeout || 8000,
        headers: {
          'User-Agent': options.userAgent || 'Student-Data-Management/1.0',
          Accept: 'application/json',
          'Accept-Encoding': 'identity'
        }
      },
      (response) => {
        const { statusCode } = response;
        if (statusCode && statusCode >= 400) {
          response.resume();
          reject(
            new Error(
              `Holiday API responded with status ${statusCode} for ${url}`
            )
          );
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => {
          chunks.push(
            typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk
          );
        });
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          let rawData = buffer.toString('utf8');

          const encoding =
            response.headers['content-encoding'] ||
            response.headers['Content-Encoding'];
          if (
            buffer.length > 0 &&
            encoding &&
            encoding.toLowerCase().includes('gzip')
          ) {
            try {
              const uncompressed = zlib.gunzipSync(buffer);
              rawData = uncompressed.toString('utf8');
            } catch (zipError) {
              reject(
                new Error(
                  `Failed to decompress holiday API response for ${url}: ${zipError.message}`
                )
              );
              return;
            }
          }

          resolve(parseJsonSafely(rawData, url));
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`Holiday API request timed out for ${url}`));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });

const fetchJson = async (url, options = {}) => fetchJsonLegacy(url, options);

const normalizeHoliday = (holiday) => ({
  date: holiday.date,
  localName: holiday.localName || holiday.name || 'Unnamed Holiday',
  name: holiday.name || holiday.localName || 'Unnamed Holiday',
  countryCode: holiday.countryCode,
  fixed: Boolean(holiday.fixed),
  global: Boolean(holiday.global),
  counties: holiday.counties || null,
  launchYear: holiday.launchYear || null,
  types: Array.isArray(holiday.types) ? holiday.types : []
});

const getPublicHolidaysForYear = async (year, countryCode = 'IN') => {
  const cacheKey = `holidays:${countryCode}:${year}`;
  const cached = holidayCache.get(cacheKey);
  if (cached) {
    return { holidays: cached, fromCache: true };
  }

  const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;

  let normalized = [];
  let responseError = null;

  try {
    const response = await fetchJson(url);
    normalized = Array.isArray(response) ? response.map(normalizeHoliday) : [];
  } catch (error) {
    responseError = error;
    normalized = [];
  }

  if (!normalized.length) {
    const fallback = getFallbackHolidays(countryCode, year);
    if (fallback.length) {
      normalized = fallback.map(normalizeHoliday);
      if (responseError) {
        console.warn(
          `Using fallback holiday dataset for ${countryCode}-${year}: ${responseError.message || responseError}`
        );
      }
    } else if (responseError) {
      console.warn(
        `No holiday data available for ${countryCode}-${year}: ${responseError.message || responseError}`
      );
    }
  }

  holidayCache.set(cacheKey, normalized, HOLIDAY_CACHE_TTL);

  return { holidays: normalized, fromCache: false };
};

const filterHolidaysByRegion = (holidays, regionCode) => {
  if (!regionCode) {
    return holidays;
  }

  return holidays.filter((holiday) => {
    if (!Array.isArray(holiday.counties) || holiday.counties.length === 0) {
      // If no counties specified, assume it applies everywhere
      return true;
    }

    return holiday.counties.some((county) => county.endsWith(regionCode));
  });
};

const getHolidaysForMonth = async ({
  year,
  month,
  countryCode = 'IN',
  regionCode
}) => {
  const { holidays, fromCache } = await getPublicHolidaysForYear(
    year,
    countryCode
  );

  const filteredByRegion = filterHolidaysByRegion(holidays, regionCode);

  const monthHolidays = filteredByRegion.filter((holiday) => {
    const holidayDate = new Date(holiday.date);
    return (
      holidayDate.getUTCFullYear() === year &&
      holidayDate.getUTCMonth() + 1 === month
    );
  });

  return {
    holidays: monthHolidays,
    fromCache
  };
};

module.exports = {
  getPublicHolidaysForYear,
  getHolidaysForMonth
};

