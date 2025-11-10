import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Layers,
  RefreshCcw,
  ToggleLeft,
  ToggleRight,
  Settings2,
  Landmark,
  BookOpen,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';

const defaultCourseForm = {
  name: '',
  code: '',
  totalYears: 4,
  semestersPerYear: 2,
  isActive: true
};

const CourseConfig = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(defaultCourseForm);
  const [branchForms, setBranchForms] = useState({});
  const [branchDrafts, setBranchDrafts] = useState({});
  const [savingCourseId, setSavingCourseId] = useState(null);
  const [savingBranchId, setSavingBranchId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [courseDrafts, setCourseDrafts] = useState({});
  const [editingBranch, setEditingBranch] = useState(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/courses?includeInactive=true');
      setCourses(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch courses', error);
      toast.error(error.response?.data?.message || 'Failed to fetch course configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const resetNewCourse = () => {
    setNewCourse(defaultCourseForm);
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();

    if (!newCourse.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (!newCourse.totalYears || Number(newCourse.totalYears) <= 0) {
      toast.error('Total years must be greater than zero');
      return;
    }

    if (!newCourse.semestersPerYear || Number(newCourse.semestersPerYear) <= 0) {
      toast.error('Semesters per year must be greater than zero');
      return;
    }

    try {
      setCreatingCourse(true);
      await api.post('/courses', {
        name: newCourse.name.trim(),
        code: newCourse.code?.trim() || undefined,
        totalYears: Number(newCourse.totalYears),
        semestersPerYear: Number(newCourse.semestersPerYear),
        isActive: newCourse.isActive
      });
      toast.success('Course created successfully');
      resetNewCourse();
      await fetchCourses();
    } catch (error) {
      console.error('Failed to create course', error);
      toast.error(error.response?.data?.message || 'Failed to create course');
    } finally {
      setCreatingCourse(false);
    }
  };

  const toggleCourseActive = async (course) => {
    try {
      setSavingCourseId(course.id);
      await api.put(`/courses/${course.id}`, {
        isActive: !course.isActive
      });
      toast.success(`Course ${!course.isActive ? 'activated' : 'deactivated'}`);
      await fetchCourses();
    } catch (error) {
      console.error('Failed to toggle course status', error);
      toast.error(error.response?.data?.message || 'Failed to update course status');
    } finally {
      setSavingCourseId(null);
    }
  };

  const toggleBranchActive = async (courseId, branch) => {
    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        isActive: !branch.isActive
      });
      toast.success(`Branch ${!branch.isActive ? 'activated' : 'deactivated'}`);
      await fetchCourses();
    } catch (error) {
      console.error('Failed to toggle branch status', error);
      toast.error(error.response?.data?.message || 'Failed to update branch status');
    } finally {
      setSavingBranchId(null);
    }
  };

  const updateCourseDraft = (courseId, field, value) => {
    setCourseDrafts((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || {}),
        [field]: value
      }
    }));
  };

  const handleEditCourse = (course) => {
    setEditingCourseId(course.id);
    setCourseDrafts((prev) => ({
      ...prev,
      [course.id]: {
        totalYears: course.totalYears,
        semestersPerYear: course.semestersPerYear,
        code: course.code || '',
        name: course.name
      }
    }));
  };

  const cancelEditCourse = (courseId) => {
    setEditingCourseId(null);
    setCourseDrafts((prev) => {
      const updated = { ...prev };
      delete updated[courseId];
      return updated;
    });
  };

  const saveCourseEdits = async (courseId) => {
    const draft = courseDrafts[courseId];
    if (!draft) {
      toast.error('No changes to save');
      return;
    }

    if (!draft.totalYears || Number(draft.totalYears) <= 0) {
      toast.error('Total years must be greater than zero');
      return;
    }

    if (!draft.semestersPerYear || Number(draft.semestersPerYear) <= 0) {
      toast.error('Semesters per year must be greater than zero');
      return;
    }

    try {
      setSavingCourseId(courseId);
      await api.put(`/courses/${courseId}`, {
        totalYears: Number(draft.totalYears),
        semestersPerYear: Number(draft.semestersPerYear),
        name: draft.name?.trim(),
        code: draft.code?.trim() || undefined
      });
      toast.success('Course updated successfully');
      await fetchCourses();
      cancelEditCourse(courseId);
    } catch (error) {
      console.error('Failed to update course', error);
      toast.error(error.response?.data?.message || 'Failed to update course');
    } finally {
      setSavingCourseId(null);
    }
  };

  const updateBranchForm = (courseId, field, value) => {
    setBranchForms((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || {}),
        [field]: value
      }
    }));
  };

  const handleAddBranch = async (course) => {
    const payload = branchForms[course.id] || {};

    if (!payload.name || !payload.name.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      setSavingBranchId(`new-${course.id}`);
      await api.post(`/courses/${course.id}/branches`, {
        name: payload.name.trim(),
        code: payload.code?.trim() || undefined,
        totalYears: Number(payload.totalYears || course.totalYears),
        semestersPerYear: Number(payload.semestersPerYear || course.semestersPerYear),
        isActive: true
      });
      toast.success('Branch added successfully');
      setBranchForms((prev) => {
        const updated = { ...prev };
        delete updated[course.id];
        return updated;
      });
      await fetchCourses();
    } catch (error) {
      console.error('Failed to add branch', error);
      toast.error(error.response?.data?.message || 'Failed to add branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const startEditBranch = (courseId, branch) => {
    setEditingBranch({ courseId, branchId: branch.id });
    setBranchDrafts((prev) => ({
      ...prev,
      [branch.id]: {
        name: branch.name || '',
        code: branch.code || '',
        totalYears: branch.totalYears || courseDrafts[courseId]?.totalYears || branch.totalYears || courseOptionsSummary.defaultYears,
        semestersPerYear:
          branch.semestersPerYear || courseDrafts[courseId]?.semestersPerYear || branch.semestersPerYear || courseOptionsSummary.defaultSemesters
      }
    }));
  };

  const cancelEditBranch = () => {
    setEditingBranch(null);
  };

  const updateBranchDraft = (branchId, field, value) => {
    setBranchDrafts((prev) => ({
      ...prev,
      [branchId]: {
        ...(prev[branchId] || {}),
        [field]: value
      }
    }));
  };

  const saveBranchEdit = async (courseId, branch) => {
    const draft = branchDrafts[branch.id];

    if (!draft || !draft.name?.trim()) {
      toast.error('Branch name is required');
      return;
    }

    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        name: draft.name.trim(),
        code: draft.code?.trim() || undefined,
        totalYears: draft.totalYears ? Number(draft.totalYears) : undefined,
        semestersPerYear: draft.semestersPerYear ? Number(draft.semestersPerYear) : undefined
      });

      toast.success('Branch updated successfully');
      cancelEditBranch();
      await fetchCourses();
    } catch (error) {
      console.error('Failed to update branch', error);
      toast.error(error.response?.data?.message || 'Failed to update branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const deleteBranch = async (courseId, branch) => {
    const confirmed = window.confirm(`Delete branch "${branch.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      setSavingBranchId(branch.id);
      await api.delete(`/courses/${courseId}/branches/${branch.id}`, {
        params: { hard: true }
      });
      toast.success('Branch deleted successfully');
      cancelEditBranch();
      await fetchCourses();
    } catch (error) {
      console.error('Failed to delete branch', error);
      toast.error(error.response?.data?.message || 'Failed to delete branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const courseOptionsSummary = useMemo(() => {
    const courseCount = courses.filter((course) => course.isActive).length;
    const branchCount = courses.reduce(
      (acc, course) =>
        acc +
        (course.branches || []).filter((branch) => branch.isActive).length,
      0
    );

    return {
      courseCount,
      branchCount,
      defaultYears: 4,
      defaultSemesters: 2
    };
  }, [courses]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingAnimation
          width={32}
          height={32}
          message="Loading course configuration..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6 bg-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">Course Configuration</h1>
          <p className="text-gray-600 text-sm">
            Manage the courses and branches that appear across the admin tools and forms.
          </p>
        </div>
        <button
          onClick={fetchCourses}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={BookOpen} title="Active Courses" value={courseOptionsSummary.courseCount} />
        <StatCard icon={Layers} title="Active Branches" value={courseOptionsSummary.branchCount} />
        <StatCard icon={Landmark} title="Forms Using Config" value="All" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Plus size={16} />
          Add course
        </h2>
        <form onSubmit={handleCreateCourse} className="grid grid-cols-1 gap-3 sm:grid-cols-5 text-sm">
          <TextField
            label="Name"
            value={newCourse.name}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, name: value }))}
            placeholder="e.g., B.Tech"
            required
            className="sm:col-span-2"
          />
          <TextField
            label="Code"
            value={newCourse.code}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, code: value }))}
            placeholder="Optional"
          />
          <NumberField
            label="Years"
            value={newCourse.totalYears}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, totalYears: value }))}
            min={1}
            max={10}
          />
          <NumberField
            label="Semesters / Year"
            value={newCourse.semestersPerYear}
            onChange={(value) =>
              setNewCourse((prev) => ({ ...prev, semestersPerYear: value }))
            }
            min={1}
            max={4}
          />
          <div className="flex items-end">
            <button
              type="submit"
              disabled={creatingCourse}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creatingCourse ? (
                <LoadingAnimation width={14} height={14} showMessage={false} variant="inline" />
              ) : (
                <Plus size={14} />
              )}
              Save
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {courses.length === 0 ? (
          <EmptyState />
        ) : (
          courses.map((course) => {
            const draft = courseDrafts[course.id] || {};
            const branchForm = branchForms[course.id] || {
              totalYears: course.totalYears,
              semestersPerYear: course.semestersPerYear
            };
            return (
              <div
                key={course.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-base font-semibold text-gray-900">{course.name}</span>
                      {!course.isActive && (
                        <span className="rounded-md bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {course.code ? `Code: ${course.code}` : 'No code'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {course.totalYears} years · {course.semestersPerYear} semesters/year
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      onClick={() => toggleCourseActive(course)}
                      disabled={savingCourseId === course.id}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {course.isActive ? (
                        <>
                          <ToggleRight size={14} className="text-green-600" />
                          Active
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={14} className="text-gray-500" />
                          Activate
                        </>
                      )}
                    </button>
                    {editingCourseId === course.id ? (
                      <>
                        <button
                          onClick={() => saveCourseEdits(course.id)}
                          disabled={savingCourseId === course.id}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => cancelEditCourse(course.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleEditCourse(course)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {editingCourseId === course.id && (
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-dashed border-gray-200 pt-3 text-xs sm:grid-cols-4">
                    <TextField
                      label="Name"
                      value={draft.name ?? course.name}
                      onChange={(value) => updateCourseDraft(course.id, 'name', value)}
                      required
                    />
                    <TextField
                      label="Code"
                      value={draft.code ?? course.code ?? ''}
                      onChange={(value) => updateCourseDraft(course.id, 'code', value)}
                    />
                    <NumberField
                      label="Years"
                      value={draft.totalYears ?? course.totalYears}
                      onChange={(value) => updateCourseDraft(course.id, 'totalYears', value)}
                      min={1}
                      max={10}
                    />
                    <NumberField
                      label="Semesters / Year"
                      value={draft.semestersPerYear ?? course.semestersPerYear}
                      onChange={(value) =>
                        updateCourseDraft(course.id, 'semestersPerYear', value)
                      }
                      min={1}
                      max={4}
                    />
                  </div>
                )}

                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-900">Branches</h3>
                  {course.branches && course.branches.length > 0 ? (
                    <div className="space-y-2">
                      {course.branches.map((branch) => {
                        const isEditing =
                          editingBranch &&
                          editingBranch.courseId === course.id &&
                          editingBranch.branchId === branch.id;
                        const branchDraft = branchDrafts[branch.id] || branch;

                        return (
                          <div
                            key={branch.id}
                            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="space-y-1 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={branchDraft.name}
                                        onChange={(e) =>
                                          updateBranchDraft(branch.id, 'name', e.target.value)
                                        }
                                        className="w-40 rounded border border-gray-300 px-2 py-1 text-xs"
                                      />
                                    ) : (
                                      branch.name
                                    )}
                                  </span>
                                  {!branch.isActive && (
                                    <span className="rounded bg-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                                      inactive
                                    </span>
                                  )}
                                </div>
                                <div className="text-gray-500">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={branchDraft.code || ''}
                                      onChange={(e) =>
                                        updateBranchDraft(branch.id, 'code', e.target.value)
                                      }
                                      placeholder="Code"
                                      className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
                                    />
                                  ) : branch.code ? (
                                    `Code: ${branch.code}`
                                  ) : (
                                    'No code'
                                  )}
                                </div>
                                <div className="text-gray-500">
                                  {isEditing ? (
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        min={1}
                                        max={10}
                                        value={branchDraft.totalYears ?? course.totalYears}
                                        onChange={(e) =>
                                          updateBranchDraft(branch.id, 'totalYears', e.target.value)
                                        }
                                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                                      />
                                      <input
                                        type="number"
                                        min={1}
                                        max={4}
                                        value={
                                          branchDraft.semestersPerYear ?? course.semestersPerYear
                                        }
                                        onChange={(e) =>
                                          updateBranchDraft(
                                            branch.id,
                                            'semestersPerYear',
                                            e.target.value
                                          )
                                        }
                                        className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      {branch.structure?.totalYears ?? branch.totalYears ?? course.totalYears}{' '}
                                      years ·{' '}
                                      {branch.structure?.semestersPerYear ??
                                        branch.semestersPerYear ??
                                        course.semestersPerYear}{' '}
                                      semesters/year
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-600">
                                {isEditing ? (
                                  <>
                                    <button
                                      onClick={() => saveBranchEdit(course.id, branch)}
                                      disabled={savingBranchId === branch.id}
                                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={cancelEditBranch}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-100"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditBranch(course.id, branch)}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-100"
                                    >
                                      <Pencil size={12} />
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteBranch(course.id, branch)}
                                      disabled={savingBranchId === branch.id}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                    >
                                      <Trash2 size={12} />
                                      Delete
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => toggleBranchActive(course.id, branch)}
                                  disabled={savingBranchId === branch.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 hover:bg-gray-100 disabled:opacity-50"
                                >
                                  {branch.isActive ? (
                                    <>
                                      <ToggleRight size={12} className="text-green-600" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={12} className="text-gray-500" />
                                      Activate
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No branches yet.</p>
                  )}
                </div>

                <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs">
                  <p className="mb-2 font-semibold text-gray-900">Add branch</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                    <input
                      type="text"
                      value={branchForm.name || ''}
                      onChange={(e) => updateBranchForm(course.id, 'name', e.target.value)}
                      placeholder="Name"
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                    <input
                      type="text"
                      value={branchForm.code || ''}
                      onChange={(e) => updateBranchForm(course.id, 'code', e.target.value)}
                      placeholder="Code"
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={branchForm.totalYears ?? course.totalYears}
                      onChange={(e) =>
                        updateBranchForm(course.id, 'totalYears', e.target.value)
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                      placeholder="Years"
                    />
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={branchForm.semestersPerYear ?? course.semestersPerYear}
                      onChange={(e) =>
                        updateBranchForm(course.id, 'semestersPerYear', e.target.value)
                      }
                      className="rounded border border-gray-300 px-2 py-1"
                      placeholder="Sem / yr"
                    />
                    <button
                      onClick={() => handleAddBranch(course)}
                      disabled={savingBranchId === `new-${course.id}`}
                      className="inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingBranchId === `new-${course.id}` ? (
                        <LoadingAnimation width={12} height={12} showMessage={false} variant="inline" />
                      ) : (
                        <Plus size={12} />
                      )}
                      Add
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, placeholder = '', required = false, className = '' }) => (
  <label className={`flex flex-col gap-1 ${className}`}>
    <span className="text-xs font-medium text-gray-600">
      {label}
      {required && <span className="text-red-500">*</span>}
    </span>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </label>
);

const NumberField = ({ label, value, onChange, min, max, className = '' }) => (
  <label className={`flex flex-col gap-1 ${className}`}>
    <span className="text-xs font-medium text-gray-600">{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  </label>
);

const StatCard = ({ icon: Icon, title, value }) => (
  <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
      <Icon size={18} />
    </div>
    <div>
      <p className="text-xs text-gray-600">{title}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  </div>
);

const EmptyState = () => (
  <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-600">
    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
      <Settings2 size={20} className="text-gray-500" />
    </div>
    <h3 className="text-base font-semibold text-gray-900">No courses yet</h3>
    <p className="mt-1 text-sm text-gray-600">
      Add your first course above to configure its branches and academic stages.
    </p>
  </div>
);

export default CourseConfig;

