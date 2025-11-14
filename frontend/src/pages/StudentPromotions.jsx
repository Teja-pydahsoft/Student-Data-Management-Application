import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp,
  Filter,
  Users,
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const DEFAULT_MAX_YEAR = 10;
const DEFAULT_SEMESTERS_PER_YEAR = 2;

const syncStageFields = (data = {}, year, semester) => {
  if (!year || !semester) {
    return { ...data };
  }
  return {
    ...data,
    current_year: Number(year),
    current_semester: Number(semester),
    'Current Academic Year': Number(year),
    'Current Semester': Number(semester)
  };
};

const StudentPromotions = () => {
  const [filters, setFilters] = useState({
    batch: '',
    course: '',
    branch: '',
    year: '',
    semester: ''
  });
  const [quickFilterOptions, setQuickFilterOptions] = useState({
    batches: [],
    courses: [],
    branches: [],
    years: [],
    semesters: []
  });
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedAdmissionNumbers, setSelectedAdmissionNumbers] = useState(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [promotionResults, setPromotionResults] = useState(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [promotionPlan, setPromotionPlan] = useState([]);
  const [hasStageConflicts, setHasStageConflicts] = useState(false);
  const latestRequestRef = useRef(0);

  const selectedCount = selectedAdmissionNumbers.size;
  const isAllSelected = students.length > 0 && selectedCount === students.length;

  useEffect(() => {
    fetchQuickFilterOptions();
  }, []);

  const fetchQuickFilterOptions = async () => {
    setLoadingFilters(true);
    try {
      const response = await api.get('/attendance/filters');
      if (response.data?.success) {
        const data = response.data.data || {};
        setQuickFilterOptions({
          batches: data.batches || [],
          courses: data.courses || [],
          branches: data.branches || [],
          years: data.years || [],
          semesters: data.semesters || []
        });
      }
    } catch (error) {
      toast.error('Failed to load filter metadata');
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      batch: '',
      course: '',
      branch: '',
      year: '',
      semester: ''
    });
    setStudents([]);
    setSelectedAdmissionNumbers(new Set());
    setPromotionResults(null);
  };

  const buildStudentQueryParams = () => {
    const params = { limit: 'all' };
    if (filters.batch) params.filter_batch = filters.batch;
    if (filters.course) params.filter_course = filters.course;
    if (filters.branch) params.filter_branch = filters.branch;
    if (filters.year) params.filter_year = filters.year;
    if (filters.semester) params.filter_semester = filters.semester;
    return params;
  };

  const loadStudents = useCallback(
    async ({ showToast = false } = {}) => {
      const requestId = Date.now();
      latestRequestRef.current = requestId;
      setLoadingStudents(true);
      setPromotionResults(null);
      setSelectedAdmissionNumbers(new Set());
      try {
        const response = await api.get('/students', {
          params: buildStudentQueryParams()
        });

        if (latestRequestRef.current !== requestId) {
          return;
        }

        if (response.data?.success) {
          const data = Array.isArray(response.data.data) ? response.data.data : [];
          setStudents(data);
          if (showToast) {
            if (data.length === 0) {
              toast('No students found for selected criteria', { icon: 'ℹ️' });
            } else {
              toast.success(`Loaded ${data.length} student${data.length === 1 ? '' : 's'}`);
            }
          }
        } else {
          setStudents([]);
          if (showToast) {
            toast.error(response.data?.message || 'Failed to load students');
          }
        }
      } catch (error) {
        if (latestRequestRef.current === requestId) {
          setStudents([]);
        }
        if (showToast) {
          toast.error(error.response?.data?.message || 'Failed to load students');
        }
      } finally {
        if (latestRequestRef.current === requestId) {
          setLoadingStudents(false);
        }
      }
    },
    [filters]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents({ showToast: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [filters, loadStudents]);

  const toggleSelectAllStudents = (checked) => {
    setSelectedAdmissionNumbers(checked ? new Set(students.map((s) => s.admission_number)) : new Set());
  };

  const toggleSelectStudent = (admissionNumber) => {
    setSelectedAdmissionNumbers((prev) => {
      const updated = new Set(prev);
      if (updated.has(admissionNumber)) {
        updated.delete(admissionNumber);
      } else {
        updated.add(admissionNumber);
      }
      return updated;
    });
  };

  const getStudentName = (student) => {
    const data = student.student_data;
    if (data && typeof data === 'object') {
      const nameKey = Object.keys(data).find((key) => {
        const lower = key.toLowerCase();
        return lower === 'name' || lower.includes('student name');
      });
      if (nameKey && data[nameKey]) {
        return data[nameKey];
      }
    }
    return student.student_name || '-';
  };

  const promotionSummary = useMemo(() => {
    if (!promotionResults || !Array.isArray(promotionResults)) {
      return null;
    }
    return promotionResults.reduce(
      (acc, result) => {
        if (result.status === 'success') acc.success += 1;
        else if (result.status === 'skipped') acc.skipped += 1;
        else acc.errors += 1;
        return acc;
      },
      { success: 0, skipped: 0, errors: 0 }
    );
  }, [promotionResults]);

  const getCurrentStageFromStudent = (student) => {
    if (!student) {
      return null;
    }

    const data = student.student_data || {};
    const year =
      Number(student.current_year) ||
      Number(data.current_year) ||
      Number(data['Current Academic Year']);
    const semester =
      Number(student.current_semester) ||
      Number(data.current_semester) ||
      Number(data['Current Semester']);

    if (!Number.isFinite(year) || !Number.isFinite(semester)) {
      return null;
    }

    return { year, semester };
  };

  const getNextStage = (year, semester) => {
    const normalizedYear = Number(year);
    const normalizedSemester = Number(semester);

    if (
      !Number.isInteger(normalizedYear) ||
      !Number.isInteger(normalizedSemester) ||
      normalizedYear < 1 ||
      normalizedSemester < 1
    ) {
      return null;
    }

    if (normalizedSemester < DEFAULT_SEMESTERS_PER_YEAR) {
      return {
        year: normalizedYear,
        semester: normalizedSemester + 1
      };
    }

    if (normalizedYear >= DEFAULT_MAX_YEAR) {
      return null;
    }

    return {
      year: normalizedYear + 1,
      semester: 1
    };
  };

  const handlePromoteSelected = () => {
    if (selectedAdmissionNumbers.size === 0) {
      toast.error('Select at least one student to promote');
      return;
    }

    const plan = Array.from(selectedAdmissionNumbers).map((admissionNumber) => {
      const student = students.find((entry) => entry.admission_number === admissionNumber);
      const currentStage = getCurrentStageFromStudent(student);
      const nextStage = currentStage ? getNextStage(currentStage.year, currentStage.semester) : null;

      const issues = [];

      if (!student) {
        issues.push('Student record not found');
      }

      if (!currentStage) {
        issues.push('Missing current academic stage');
      }

      if (currentStage && !nextStage) {
        issues.push('Student is already at the final configured stage');
      }

      let hasConflict = false;
      if (nextStage) {
        hasConflict = students.some(
          (candidate) =>
            candidate.admission_number !== admissionNumber &&
            Number(candidate.current_year) === Number(nextStage.year) &&
            Number(candidate.current_semester) === Number(nextStage.semester)
        );
      }

      return {
        admissionNumber,
        studentName: getStudentName(student),
        currentStage,
        nextStage,
        issues,
        hasConflict
      };
    });

    setPromotionPlan(plan);
    setHasStageConflicts(plan.some((item) => item.hasConflict));
    setConfirmationOpen(true);
  };

  const executePromotion = async () => {
    const promotableStudents = promotionPlan.filter(
      (item) => item.nextStage && item.issues.length === 0
    );

    if (promotableStudents.length === 0) {
      toast.error('No eligible students to promote');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/students/promotions/bulk', {
        students: promotableStudents.map((item) => ({ admissionNumber: item.admissionNumber }))
      });

      const results = response.data?.results || [];
      setPromotionResults(results);

      const successCount = results.filter((result) => result.status === 'success').length;
      if (successCount > 0) {
        toast.success(`Successfully promoted ${successCount} student${successCount === 1 ? '' : 's'}`);
      } else {
        toast.error('No students were promoted');
      }

      if (successCount > 0) {
        setStudents((prevStudents) =>
          prevStudents.map((student) => {
            const match = results.find(
              (result) => result.admissionNumber === student.admission_number && result.status === 'success'
            );
            if (!match) {
              return student;
            }

            const updatedData = syncStageFields(
              student.student_data || {},
              match.currentYear,
              match.currentSemester
            );

            return {
              ...student,
              current_year: match.currentYear,
              current_semester: match.currentSemester,
              student_data: updatedData
            };
          })
        );
      }
      setConfirmationOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to promote students');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 heading-font flex items-center gap-3">
            <TrendingUp className="text-indigo-600" size={28} />
            Student Promotions
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchQuickFilterOptions}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            disabled={loadingFilters}
          >
            {loadingFilters ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Refresh Options
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter size={18} />
          <h2 className="text-lg font-semibold">Promotion Criteria</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Batch</label>
            <select
              value={filters.batch}
              onChange={(e) => handleFilterChange('batch', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Batches</option>
              {(quickFilterOptions.batches || []).map((batch) => (
                <option key={batch} value={batch}>
                  {batch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Course</label>
            <select
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Courses</option>
              {(quickFilterOptions.courses || []).map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Branch</label>
            <select
              value={filters.branch}
              onChange={(e) => handleFilterChange('branch', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Branches</option>
              {(quickFilterOptions.branches || []).map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Current Year
            </label>
            <select
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Years</option>
              {(quickFilterOptions.years || []).map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Current Semester
            </label>
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">All Semesters</option>
              {(quickFilterOptions.semesters || []).map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <div className="text-sm text-gray-600">
            Adjust the filters to refresh the matching students automatically.
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Promotion Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            Promotion Review
          </h2>
          <p className="text-sm text-gray-600">
            Selected students will be moved to their next academic stage. Confirm the summary before
            continuing.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users size={16} />
            <span>
              Selected {selectedCount} of {students.length} student{students.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => toggleSelectAllStudents(true)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
              disabled={students.length === 0}
            >
              Select All
            </button>
            <button
              onClick={() => setSelectedAdmissionNumbers(new Set())}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
              disabled={selectedCount === 0}
            >
              Clear Selection
            </button>
            <button
              onClick={handlePromoteSelected}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-transform hover:-translate-y-0.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={selectedCount === 0 || submitting}
            >
              {submitting ? 'Promoting...' : 'Promote Selected'}
            </button>
          </div>
        </div>

        {promotionSummary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-100 rounded-lg px-3 py-2 text-sm">
              <CheckCircle size={16} />
              <span>Promoted: {promotionSummary.success}</span>
            </div>
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-lg px-3 py-2 text-sm">
              <RefreshCw size={16} />
              <span>Skipped: {promotionSummary.skipped}</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 text-red-700 border border-red-100 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle size={16} />
              <span>Errors: {promotionSummary.errors}</span>
            </div>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Matched Students</h2>
            <p className="text-sm text-gray-600">
              Review the students that match the current criteria and choose who to promote.
            </p>
          </div>
          <div className="text-sm text-gray-600">
            Total: {students.length} student{students.length === 1 ? '' : 's'}
          </div>
        </div>

        {loadingStudents ? (
          <div className="py-12 flex flex-col items-center justify-center text-sm text-gray-600 gap-3">
            <LoadingAnimation width={32} height={32} showMessage={false} />
            Loading student list...
          </div>
        ) : students.length === 0 ? (
          <div className="py-12 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
            Adjust the filters to find the students you want to promote.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => toggleSelectAllStudents(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Admission Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Student Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Course / Branch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Current Stage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Batch
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      Updated At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((student) => {
                    const admissionNumber = student.admission_number;
                    const isSelected = selectedAdmissionNumbers.has(admissionNumber);
                    return (
                      <tr
                        key={admissionNumber}
                        className={isSelected ? 'bg-indigo-50/40' : 'bg-white'}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectStudent(admissionNumber)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {admissionNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {getStudentName(student)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="block font-medium text-gray-800">
                            {student.course || '-'}
                          </span>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                            {student.branch || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold">
                            Year {student.current_year || '-'} • Sem {student.current_semester || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{student.batch || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {student.updated_at ? formatDate(student.updated_at) : formatDate(student.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {promotionResults && promotionResults.length > 0 && (
              <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Latest Promotion Results</h3>
                </div>
                <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
                  {promotionResults.map((result, index) => {
                    const isSuccess = result.status === 'success';
                    const isSkipped = result.status === 'skipped';
                    const statusColor = isSuccess
                      ? 'text-green-700'
                      : isSkipped
                        ? 'text-amber-700'
                        : 'text-red-700';
                    const statusBg = isSuccess
                      ? 'bg-green-50 border-green-100'
                      : isSkipped
                        ? 'bg-amber-50 border-amber-100'
                        : 'bg-red-50 border-red-100';
                    return (
                      <li
                        key={`${result.admissionNumber || index}-${result.status}`}
                        className={`px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-l-4 ${statusBg}`}
                      >
                        <div className="flex items-center gap-3">
                          {isSuccess ? (
                            <CheckCircle size={18} className="text-green-600" />
                          ) : isSkipped ? (
                            <RefreshCw size={18} className="text-amber-600" />
                          ) : (
                            <AlertTriangle size={18} className="text-red-600" />
                          )}
                          <div>
                            <p className={`font-semibold ${statusColor}`}>
                              {result.admissionNumber || 'Unknown admission number'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {isSuccess
                                ? `Updated to Year ${result.currentYear}, Semester ${result.currentSemester}`
                                : result.message || 'No additional details provided.'}
                            </p>
                          </div>
                        </div>
                        <div className={`text-xs font-semibold uppercase ${statusColor}`}>
                          {result.status}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {confirmationOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Promotion</h3>
              <button
                onClick={() => setConfirmationOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Close
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
              {hasStageConflicts && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm">
                  Some selected students already have peers in the target stage. Confirm that you want
                  to proceed before continuing.
                </div>
              )}
              <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Admission No</th>
                      <th className="px-4 py-3 text-left">Student Name</th>
                      <th className="px-4 py-3 text-left">Current Stage</th>
                      <th className="px-4 py-3 text-left">Next Stage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {promotionPlan.map((item) => {
                      const issueText = item.issues.filter(Boolean).join(', ');
                      const conflictText = item.hasConflict
                        ? 'Target stage already contains students'
                        : '';
                      const noteText = [issueText, conflictText].filter(Boolean).join('. ');
                      return (
                        <tr key={item.admissionNumber} className="bg-white">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {item.admissionNumber}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{item.studentName || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {item.currentStage
                              ? `Year ${item.currentStage.year} • Sem ${item.currentStage.semester}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {item.nextStage ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold">
                                <ArrowRight size={14} />
                                Year {item.nextStage.year} • Sem {item.nextStage.semester}
                              </span>
                            ) : (
                              <span className="text-red-600 text-xs font-semibold">Not eligible</span>
                            )}
                            {noteText && (
                              <p className="mt-1 text-xs text-gray-500">{noteText}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm text-gray-600">
                Only students marked as eligible will be promoted. Others will remain unchanged.
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setConfirmationOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={executePromotion}
                  className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-transform hover:-translate-y-0.5 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Promoting...' : 'Confirm Promotion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPromotions;

