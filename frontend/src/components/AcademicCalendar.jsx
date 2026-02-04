import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, X, Calendar, GraduationCap, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from './LoadingAnimation';

const AcademicCalendar = ({ colleges, courses, academicYears }) => {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [filterCollegeId, setFilterCollegeId] = useState('');
  const [filterCourseId, setFilterCourseId] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    collegeId: '',
    courseId: '',
    academicYearId: '',
    yearOfStudy: '',
    semesterNumber: '',
    startDate: '',
    endDate: ''
  });

  // Normalize academic year label to YYYY-YYYY format
  const normalizeYearLabel = (yearLabel) => {
    if (!yearLabel) return null;

    // If already in YYYY-YYYY format, return as is
    if (/^\d{4}-\d{4}$/.test(yearLabel)) {
      return yearLabel;
    }

    // If it's just a year (YYYY), convert to YYYY-YYYY
    if (/^\d{4}$/.test(yearLabel)) {
      const year = parseInt(yearLabel);
      return `${year}-${year + 1}`;
    }

    // Return as is if format is unknown
    return yearLabel;
  };

  // Generate academic years in YYYY-YYYY format (past 5 years to future 5 years)
  const generateAcademicYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];

    // Generate past 5 years to future 5 years (total 11 years)
    for (let i = -5; i <= 5; i++) {
      const startYear = currentYear + i;
      const endYear = startYear + 1;
      const yearLabel = `${startYear}-${endYear}`;

      // Check if this year already exists in the database (normalize for comparison)
      const existingYear = academicYears.find(y => {
        const normalized = normalizeYearLabel(y.yearLabel);
        return normalized === yearLabel;
      });

      years.push({
        id: existingYear?.id || null, // Use existing ID if found
        yearLabel: yearLabel,
        startYear: startYear,
        endYear: endYear,
        isActive: existingYear?.isActive !== false, // Default to active if not in DB
        existsInDb: !!existingYear
      });
    }

    return years;
  };

  // Available academic years (combine generated years with existing ones)
  const availableAcademicYears = useMemo(() => {
    const generatedYears = generateAcademicYearOptions();

    // Create a map of normalized year labels to existing years
    const existingYearsMap = new Map();
    academicYears.forEach(y => {
      const normalized = normalizeYearLabel(y.yearLabel);
      if (normalized) {
        existingYearsMap.set(normalized, y);
      }
    });

    // Merge: use existing years from DB when available, otherwise use generated ones
    return generatedYears.map(year => {
      const existing = existingYearsMap.get(year.yearLabel);
      if (existing) {
        return {
          id: existing.id,
          yearLabel: year.yearLabel, // Use normalized format
          startYear: year.startYear,
          endYear: year.endYear,
          isActive: existing.isActive,
          existsInDb: true
        };
      }
      return year;
    });
  }, [academicYears]);

  // Available courses based on selected college (for filters)
  const availableCoursesForFilter = filterCollegeId
    ? courses.filter(c => c.collegeId === parseInt(filterCollegeId))
    : courses;

  // Available courses based on form's selected college (for modal)
  const availableCoursesForForm = formData.collegeId
    ? courses.filter(c => c.collegeId === parseInt(formData.collegeId))
    : courses;

  // Years of study options based on selected course
  const getYearsOfStudy = () => {
    if (!formData.courseId) return [];
    const course = courses.find(c => c.id === parseInt(formData.courseId));
    if (!course) return [];
    return Array.from({ length: course.totalYears }, (_, i) => i + 1);
  };

  // Semester options based on selected course and year of study
  const getSemesterOptions = () => {
    if (!formData.courseId) return [];
    const course = courses.find(c => c.id === parseInt(formData.courseId));
    if (!course) return [];

    // Check if course has per-year semester configuration
    if (course.yearSemesterConfig && Array.isArray(course.yearSemesterConfig) && formData.yearOfStudy) {
      const yearNumber = parseInt(formData.yearOfStudy);
      const yearConfig = course.yearSemesterConfig.find(y => y.year === yearNumber);
      if (yearConfig && yearConfig.semesters) {
        return Array.from({ length: yearConfig.semesters }, (_, i) => i + 1);
      }
    }

    // Fallback to default semestersPerYear
    return Array.from({ length: course.semestersPerYear || 2 }, (_, i) => i + 1);
  };

  // Fetch semesters
  const fetchSemesters = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterCollegeId) params.collegeId = filterCollegeId;
      if (filterCourseId) params.courseId = filterCourseId;
      if (filterSemester) params.semester = filterSemester;

      const response = await api.get('/semesters', { params });
      setSemesters(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch semesters', error);
      toast.error(error.response?.data?.message || 'Failed to fetch semesters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCollegeId, filterCourseId, filterSemester]);

  // Reset form
  const resetForm = () => {
    setFormData({
      collegeId: '',
      courseId: '',
      academicYearId: '',
      yearOfStudy: '',
      semesterNumber: '',
      startDate: '',
      endDate: ''
    });
    setEditingSemester(null);
  };

  // Open modal for creating new semester
  const handleAddSemester = () => {
    resetForm();
    setIsModalOpen(true);
  };

  // Open modal for editing semester
  const handleEditSemester = (semester) => {
    setFormData({
      collegeId: semester.collegeId || '',
      courseId: semester.courseId.toString(),
      academicYearId: semester.academicYearId.toString(),
      yearOfStudy: semester.yearOfStudy.toString(),
      semesterNumber: semester.semesterNumber.toString(),
      startDate: semester.startDate,
      endDate: semester.endDate
    });
    setEditingSemester(semester);
    setIsModalOpen(true);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.courseId) {
      toast.error('Please select a course');
      return;
    }

    if (!formData.academicYearId) {
      toast.error('Please select an academic year');
      return;
    }

    // Validate that the selected academic year exists in the database
    const selectedYear = availableAcademicYears.find(
      y => y.id === parseInt(formData.academicYearId) || y.yearLabel === formData.academicYearId
    );

    if (!selectedYear || !selectedYear.existsInDb) {
      toast.error('Please select an academic year that exists in the database. Create it in Settings first.');
      return;
    }

    if (!formData.yearOfStudy) {
      toast.error('Please select year of study');
      return;
    }

    if (!formData.semesterNumber) {
      toast.error('Please select semester');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    if (new Date(formData.startDate) >= new Date(formData.endDate)) {
      toast.error('End date must be after start date');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        collegeId: formData.collegeId || null,
        courseId: parseInt(formData.courseId),
        academicYearId: selectedYear.id, // Use the ID from the selected year
        yearOfStudy: parseInt(formData.yearOfStudy),
        semesterNumber: parseInt(formData.semesterNumber),
        startDate: formData.startDate,
        endDate: formData.endDate
      };

      if (editingSemester) {
        await api.put(`/semesters/${editingSemester.id}`, payload);
        toast.success('Semester updated successfully');
      } else {
        await api.post('/semesters', payload);
        toast.success('Semester created successfully');
      }

      setIsModalOpen(false);
      resetForm();
      fetchSemesters();
    } catch (error) {
      console.error('Failed to save semester', error);
      toast.error(error.response?.data?.message || 'Failed to save semester');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (semester) => {
    if (!window.confirm(`Are you sure you want to delete this semester?`)) {
      return;
    }

    try {
      await api.delete(`/semesters/${semester.id}`);
      toast.success('Semester deleted successfully');
      fetchSemesters();
    } catch (error) {
      console.error('Failed to delete semester', error);
      toast.error(error.response?.data?.message || 'Failed to delete semester');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Filtered semesters for display
  const filteredSemesters = semesters.filter(semester => {
    if (filterCollegeId && semester.collegeId !== parseInt(filterCollegeId)) return false;
    if (filterCourseId && semester.courseId !== parseInt(filterCourseId)) return false;
    if (filterSemester && semester.semesterNumber !== parseInt(filterSemester)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Academic Calendar</h2>
          <p className="text-sm text-gray-600">Manage semester dates for each course.</p>
        </div>
        <button
          onClick={handleAddSemester}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Semester
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2">
          <Landmark size={16} className="text-gray-500" />
          <select
            value={filterCollegeId}
            onChange={(e) => {
              setFilterCollegeId(e.target.value);
              setFilterCourseId(''); // Reset course filter when college changes
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Colleges</option>
            {colleges.filter(c => c.isActive).map(college => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-gray-500" />
          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Courses</option>
            {availableCoursesForFilter.filter(c => c.isActive).map(course => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">All Semesters</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
              <option key={num} value={num}>
                Semester {num}
              </option>
            ))}
          </select>
        </div>

        {(filterCollegeId || filterCourseId || filterSemester) && (
          <button
            onClick={() => {
              setFilterCollegeId('');
              setFilterCourseId('');
              setFilterSemester('');
            }}
            className="ml-auto rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingAnimation width={32} height={32} message="Loading semesters..." />
          </div>
        ) : filteredSemesters.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Calendar size={48} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No semesters found</p>
            <p className="text-xs text-gray-400 mt-1">Click "Add Semester" to create one</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">College</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">Course</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700 whitespace-nowrap">Academic Year</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">Year</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">Semester</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">Start Date</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase text-gray-700">End Date</th>
                  <th className="px-2 py-2 text-right text-[11px] font-semibold uppercase text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSemesters.map((semester) => (
                  <tr key={semester.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-2 py-1.5 text-xs text-gray-900">
                      {semester.collegeName || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-900">
                      {semester.courseName}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-900 whitespace-nowrap">
                      {normalizeYearLabel(semester.academicYearLabel) || semester.academicYearLabel}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-900">
                      Year {semester.yearOfStudy}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-900">
                      Sem {semester.semesterNumber}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(semester.startDate)}
                    </td>
                    <td className="px-2 py-1.5 text-xs text-gray-600 whitespace-nowrap">
                      {formatDate(semester.endDate)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditSemester(semester)}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(semester)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filteredSemesters.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            Showing {filteredSemesters.length} of {filteredSemesters.length} entries
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSemester ? 'Edit Semester' : 'Add New Semester'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Show current dates when editing */}
            {editingSemester && editingSemester.startDate && editingSemester.endDate && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-blue-600" />
                    <span className="font-medium text-gray-700">Current Dates:</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-gray-600">Start:</span>
                      <span className="ml-2 font-semibold text-blue-700">{formatDate(editingSemester.startDate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">End:</span>
                      <span className="ml-2 font-semibold text-blue-700">{formatDate(editingSemester.endDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* College */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  College <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.collegeId}
                  onChange={(e) => {
                    setFormData({ ...formData, collegeId: e.target.value, courseId: '' });
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select a college</option>
                  {colleges.filter(c => c.isActive).map(college => (
                    <option key={college.id} value={college.id}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Course */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Program <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.courseId}
                  onChange={(e) => {
                    setFormData({ ...formData, courseId: e.target.value, yearOfStudy: '', semesterNumber: '' });
                  }}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select a program</option>
                  {availableCoursesForForm.filter(c => c.isActive).map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name} {course.level ? `(${course.level.toUpperCase()})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Academic Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.academicYearId}
                  onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Select academic year</option>
                  {availableAcademicYears
                    .filter(y => y.existsInDb && y.isActive) // Only show years that exist in DB and are active
                    .map(year => (
                      <option
                        key={year.id}
                        value={year.id}
                      >
                        {year.yearLabel}
                      </option>
                    ))}
                </select>
                {availableAcademicYears.filter(y => !y.existsInDb).length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Note: Academic years {availableAcademicYears.filter(y => !y.existsInDb).map(y => y.yearLabel).join(', ')} are available but need to be created in Settings first.
                  </p>
                )}
              </div>

              {/* Year of Study */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Year of Study <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.yearOfStudy}
                  onChange={(e) => setFormData({ ...formData, yearOfStudy: e.target.value, semesterNumber: '' })}
                  required
                  disabled={!formData.courseId}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{formData.courseId ? 'Select year of study' : 'Select a course first'}</option>
                  {getYearsOfStudy().map(year => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Semester <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.semesterNumber}
                  onChange={(e) => setFormData({ ...formData, semesterNumber: e.target.value })}
                  required
                  disabled={!formData.courseId}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">{formData.courseId ? 'Select semester' : 'Select a course first'}</option>
                  {getSemesterOptions().map(sem => (
                    <option key={sem} value={sem}>
                      Semester {sem}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  min={formData.startDate}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : editingSemester ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;

