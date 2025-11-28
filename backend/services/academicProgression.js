const MAX_YEARS = 10;
const MAX_SEMESTERS_PER_YEAR = 4;
const DEFAULT_SEMESTERS_PER_YEAR = 2;

const buildDefaultStages = () => {
  const stages = [];
  for (let year = 1; year <= MAX_YEARS; year += 1) {
    for (let semester = 1; semester <= DEFAULT_SEMESTERS_PER_YEAR; semester += 1) {
      stages.push({ year, semester });
    }
  }
  return stages;
};

const ACADEMIC_STAGES = buildDefaultStages();

const isValidStage = (year, semester) => {
  const y = Number(year);
  const s = Number(semester);

  if (!Number.isInteger(y) || !Number.isInteger(s)) {
    return false;
  }

  if (y < 1 || y > MAX_YEARS) {
    return false;
  }

  if (s < 1 || s > MAX_SEMESTERS_PER_YEAR) {
    return false;
  }

  return true;
};

const normalizeStage = (year, semester) => {
  const y = Number(year);
  const s = Number(semester);

  if (!isValidStage(y, s)) {
    throw new Error('INVALID_STAGE');
  }

  return { year: y, semester: s };
};

const getNextStage = (year, semester, courseConfig = null) => {
  const { year: normalizedYear, semester: normalizedSemester } = normalizeStage(year, semester);

  // Get semester count for current year from course configuration
  let semestersForCurrentYear = DEFAULT_SEMESTERS_PER_YEAR;
  
  if (courseConfig) {
    // Check for per-year semester configuration (prioritize this)
    if (courseConfig.yearSemesterConfig && Array.isArray(courseConfig.yearSemesterConfig) && courseConfig.yearSemesterConfig.length > 0) {
      const yearConfig = courseConfig.yearSemesterConfig.find(y => Number(y.year) === normalizedYear);
      if (yearConfig && yearConfig.semesters) {
        semestersForCurrentYear = Number(yearConfig.semesters);
      } else {
        // If year config not found, fallback to default semesters per year
        semestersForCurrentYear = courseConfig.semestersPerYear || DEFAULT_SEMESTERS_PER_YEAR;
      }
    } else if (courseConfig.semestersPerYear) {
      // Fallback to default semesters per year if no per-year config
      semestersForCurrentYear = Number(courseConfig.semestersPerYear) || DEFAULT_SEMESTERS_PER_YEAR;
    }
  }

  // If current semester is less than the semester count for this year, move to next semester
  if (normalizedSemester < semestersForCurrentYear) {
    return {
      year: normalizedYear,
      semester: normalizedSemester + 1
    };
  }

  // If we've completed all semesters for this year, move to next year
  if (normalizedYear >= MAX_YEARS) {
    return null;
  }

  return {
    year: normalizedYear + 1,
    semester: 1
  };
};

module.exports = {
  ACADEMIC_STAGES,
  getNextStage,
  normalizeStage,
  isValidStage
};

