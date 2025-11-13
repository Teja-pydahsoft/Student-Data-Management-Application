import React, { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Filter,
  Users,
  CheckCircle,
  RefreshCw,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';
import { formatDate } from '../utils/dateUtils';

const PROMOTION_MODES = {
  AUTO: 'auto',
  MANUAL: 'manual'
};

const ACADEMIC_YEARS = [1, 2, 3, 4];
const ACADEMIC_SEMESTERS = [1, 2];

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
  const [promotionMode, setPromotionMode] = useState(PROMOTION_MODES.AUTO);
  const [targetYear, setTargetYear] = useState(1);
  const [targetSemester, setTargetSemester] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [promotionResults, setPromotionResults] = useState(null);

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

  const loadStudents = async () => {
    setLoadingStudents(true);
    setPromotionResults(null);
    setSelectedAdmissionNumbers(new Set());
    try {
      const response = await api.get('/students', {
        params: buildStudentQueryParams()
      });
      if (response.data?.success) {
        const data = Array.isArray(response.data.data) ? response.data.data : [];
        setStudents(data);
        if (data.length === 0) {
          toast('No students found for selected criteria', { icon: 'ℹ️' });
        } else {
          toast.success(`Loaded ${data.length} student${data.length === 1 ? '' : 's'}`);
        }
      } else {
        toast.error(response.data?.message || 'Failed to load students');
        setStudents([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load students');
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  };

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

  const handlePromoteSelected = async () => {
    if (selectedAdmissionNumbers.size === 0) {
      toast.error('Select at least one student to promote');
      return;
    }

    if (promotionMode === PROMOTION_MODES.MANUAL && (!targetYear || !targetSemester)) {
      toast.error('Select both academic year and semester for manual promotion');
      return;
    }

    setSubmitting(true);
    try {
      const studentsPayload = Array.from(selectedAdmissionNumbers).map((admissionNumber) => {
        if (promotionMode === PROMOTION_MODES.MANUAL) {
          return {
            admissionNumber,
            targetYear: Number(targetYear),
            targetSemester: Number(targetSemester)
          };
        }
        return { admissionNumber };
      });

      const response = await api.post('/students/promotions/bulk', {
        students: studentsPayload
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
          <p className="text-gray-600 mt-2 body-font max-w-2xl">
            Bulk promote students by selecting batches, courses, branches, academic years, and semesters.
            Apply the desired criteria, review the matched students, and promote them in one action.
          </p>
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
            Select one or more filters to load the matching students for promotion.
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors text-sm"
            >
              Clear Filters
            </button>
            <button
              onClick={loadStudents}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition-transform hover:-translate-y-0.5 text-sm"
              disabled={loadingStudents}
            >
              {loadingStudents ? 'Loading Students...' : 'Load Students'}
            </button>
          </div>
        </div>
      </div>

      {/* Promotion Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              Promotion Settings
            </h2>
            <p className="text-sm text-gray-600">
              Choose how the selected students should advance in their academic stage.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <button
              type="button"
              onClick={() => setPromotionMode(PROMOTION_MODES.AUTO)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                promotionMode === PROMOTION_MODES.AUTO
                  ? 'bg-white text-indigo-600 shadow border border-indigo-100'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              Automatic
            </button>
            <button
              type="button"
              onClick={() => setPromotionMode(PROMOTION_MODES.MANUAL)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                promotionMode === PROMOTION_MODES.MANUAL
                  ? 'bg-white text-indigo-600 shadow border border-indigo-100'
                  : 'text-gray-600 hover:text-indigo-600'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {promotionMode === PROMOTION_MODES.MANUAL ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Target Year
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                {ACADEMIC_YEARS.map((year) => (
                  <option key={year} value={year}>
                    Year {year}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Target Semester
              </label>
              <select
                value={targetSemester}
                onChange={(e) => setTargetSemester(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                {ACADEMIC_SEMESTERS.map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="bg-indigo-50 border border-indigo-100 text-sm text-indigo-700 rounded-lg px-4 py-3">
            Automatic promotion moves each student to their immediate next academic stage
            (Year/Semester) following the standard progression ladder.
          </div>
        )}

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
            Load students using the filters above to begin a promotion cycle.
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
    </div>
  );
};

export default StudentPromotions;

