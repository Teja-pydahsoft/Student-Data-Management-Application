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

const getNextStage = (year, semester) => {
  const { year: normalizedYear, semester: normalizedSemester } = normalizeStage(year, semester);

  if (normalizedSemester < DEFAULT_SEMESTERS_PER_YEAR) {
    return {
      year: normalizedYear,
      semester: normalizedSemester + 1
    };
  }

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

