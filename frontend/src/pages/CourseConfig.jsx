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
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import LoadingAnimation from '../components/LoadingAnimation';

const defaultCourseForm = {
  name: '',
  totalYears: 4,
  semestersPerYear: 2,
  isActive: true
};

const CourseConfig = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState(defaultCourseForm);
  const [courseDrafts, setCourseDrafts] = useState({});
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [savingCourseId, setSavingCourseId] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [courseBranches, setCourseBranches] = useState({});
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchForms, setBranchForms] = useState({});
  const [branchDrafts, setBranchDrafts] = useState({});
  const [editingBranch, setEditingBranch] = useState(null);
  const [savingBranchId, setSavingBranchId] = useState(null);

  const fetchCourses = async ({ silent = false } = {}) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const response = await api.get('/courses?includeInactive=true');
      const courseData = response.data.data || [];
      setCourses(courseData);
      return courseData;
    } catch (error) {
      console.error('Failed to fetch courses', error);
      toast.error(error.response?.data?.message || 'Failed to fetch course configuration');
      return [];
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const loadBranches = async (courseId) => {
    if (!courseId) {
      return [];
    }

    try {
      setBranchesLoading(true);
      const response = await api.get(`/courses/${courseId}/branches?includeInactive=true`);
      const branchData = response.data.data || [];
      setCourseBranches((prev) => ({
        ...prev,
        [courseId]: branchData
      }));
      return branchData;
    } catch (error) {
      console.error('Failed to fetch branches', error);
      toast.error(error.response?.data?.message || 'Failed to fetch branches');
      return [];
    } finally {
      setBranchesLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (courses.length === 0) {
      setSelectedCourseId(null);
      return;
    }

    const hasSelected = courses.some((course) => course.id === selectedCourseId);
    if (!hasSelected) {
      const firstCourseId = courses[0].id;
      setSelectedCourseId(firstCourseId);
      loadBranches(firstCourseId);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) || null,
    [courses, selectedCourseId]
  );

  useEffect(() => {
    if (!selectedCourse) {
      setEditingCourseId(null);
      setEditingBranch(null);
    }
  }, [selectedCourse]);

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
      const response = await api.post('/courses', {
        name: newCourse.name.trim(),
        totalYears: Number(newCourse.totalYears),
        semestersPerYear: Number(newCourse.semestersPerYear),
        isActive: newCourse.isActive
      });
      toast.success('Course created successfully');
      resetNewCourse();
      const createdCourse = response.data?.data;
      const updatedCourses = await fetchCourses({ silent: true });
      const nextSelectedId = createdCourse?.id || updatedCourses[0]?.id || null;
      if (nextSelectedId) {
        setSelectedCourseId(nextSelectedId);
        await loadBranches(nextSelectedId);
      }
    } catch (error) {
      console.error('Failed to create course', error);
      toast.error(error.response?.data?.message || 'Failed to create course');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleSelectCourse = async (courseId) => {
    if (!courseId) {
      return;
    }

    if (courseId === selectedCourseId) {
      await loadBranches(courseId);
      return;
    }

    setSelectedCourseId(courseId);
    setEditingCourseId(null);
    setEditingBranch(null);
    await loadBranches(courseId);
  };

  const handleRefresh = async () => {
    const updatedCourses = await fetchCourses({ silent: true });
    if (selectedCourseId && updatedCourses.some((course) => course.id === selectedCourseId)) {
      await loadBranches(selectedCourseId);
    }
  };

  const toggleCourseActive = async (course) => {
    try {
      setSavingCourseId(course.id);
      await api.put(`/courses/${course.id}`, {
        isActive: !course.isActive
      });
      toast.success(`Course ${!course.isActive ? 'activated' : 'deactivated'}`);
      await fetchCourses({ silent: true });
      if (selectedCourseId === course.id) {
        await loadBranches(course.id);
      }
    } catch (error) {
      console.error('Failed to toggle course status', error);
      toast.error(error.response?.data?.message || 'Failed to update course status');
    } finally {
      setSavingCourseId(null);
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
        name: course.name,
        totalYears: course.totalYears,
        semestersPerYear: course.semestersPerYear
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

    if (!draft.name || !draft.name.trim()) {
      toast.error('Course name is required');
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
        name: draft.name.trim(),
        totalYears: Number(draft.totalYears),
        semestersPerYear: Number(draft.semestersPerYear)
      });
      toast.success('Course updated successfully');
      await fetchCourses({ silent: true });
      await loadBranches(courseId);
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
      await loadBranches(course.id);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to add branch', error);
      toast.error(error.response?.data?.message || 'Failed to add branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const startEditBranch = (courseId, branch, courseDefaults) => {
    setEditingBranch({ courseId, branchId: branch.id });
    setBranchDrafts((prev) => ({
      ...prev,
      [branch.id]: {
        name: branch.name || '',
        totalYears: branch.totalYears ?? courseDefaults.totalYears,
        semestersPerYear: branch.semestersPerYear ?? courseDefaults.semestersPerYear
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
        totalYears: draft.totalYears ? Number(draft.totalYears) : undefined,
        semestersPerYear: draft.semestersPerYear ? Number(draft.semestersPerYear) : undefined
      });

      toast.success('Branch updated successfully');
      cancelEditBranch();
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to update branch', error);
      toast.error(error.response?.data?.message || 'Failed to update branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const toggleBranchActive = async (courseId, branch) => {
    try {
      setSavingBranchId(branch.id);
      await api.put(`/courses/${courseId}/branches/${branch.id}`, {
        isActive: !branch.isActive
      });
      toast.success(`Branch ${!branch.isActive ? 'activated' : 'deactivated'}`);
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to toggle branch status', error);
      toast.error(error.response?.data?.message || 'Failed to update branch status');
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
      await loadBranches(courseId);
      await fetchCourses({ silent: true });
    } catch (error) {
      console.error('Failed to delete branch', error);
      toast.error(error.response?.data?.message || 'Failed to delete branch');
    } finally {
      setSavingBranchId(null);
    }
  };

  const branchesForSelectedCourse = selectedCourse ? courseBranches[selectedCourse.id] || [] : [];

  const courseOptionsSummary = useMemo(() => {
    const courseCount = courses.filter((course) => course.isActive).length;
    const branchCount = courses.reduce(
      (acc, course) =>
        acc + (course.branches || []).filter((branch) => branch.isActive).length,
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
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation
          width={32}
          height={32}
          message="Loading course configuration..."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Course Configuration</h1>
          <p className="text-sm text-gray-600">
            Manage the courses and branches that appear across the admin tools and forms.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={BookOpen} title="Active Courses" value={courseOptionsSummary.courseCount} />
        <StatCard icon={Layers} title="Active Branches" value={courseOptionsSummary.branchCount} />
        <StatCard icon={Landmark} title="Forms Using Config" value="All" />
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Plus size={16} />
          Add course
        </h2>
        <form onSubmit={handleCreateCourse} className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-4">
          <TextField
            label="Name"
            value={newCourse.name}
            onChange={(value) => setNewCourse((prev) => ({ ...prev, name: value }))}
            placeholder="e.g., B.Tech"
            required
            className="sm:col-span-2"
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

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <div className="space-y-3">
          {courses.length === 0 ? (
            <EmptyState />
          ) : (
            courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isSelected={selectedCourseId === course.id}
                onSelect={() => handleSelectCourse(course.id)}
              />
            ))
          )}
        </div>

        <div>
          {selectedCourse ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">{selectedCourse.name}</h2>
                    <StatusBadge isActive={selectedCourse.isActive} />
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedCourse.totalYears} years · {selectedCourse.semestersPerYear} semesters/year
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {(selectedCourse.branches || []).length} total branches
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => toggleCourseActive(selectedCourse)}
                    disabled={savingCourseId === selectedCourse.id}
                    className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {selectedCourse.isActive ? (
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
                  {editingCourseId === selectedCourse.id ? (
                    <button
                      onClick={() => cancelEditCourse(selectedCourse.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditCourse(selectedCourse)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {editingCourseId === selectedCourse.id && (
                <div className="mt-4 grid grid-cols-1 gap-3 border-t border-dashed border-gray-200 pt-4 sm:grid-cols-3">
                  <TextField
                    label="Name"
                    value={courseDrafts[selectedCourse.id]?.name ?? selectedCourse.name}
                    onChange={(value) => updateCourseDraft(selectedCourse.id, 'name', value)}
                    required
                  />
                  <NumberField
                    label="Years"
                    value={courseDrafts[selectedCourse.id]?.totalYears ?? selectedCourse.totalYears}
                    onChange={(value) => updateCourseDraft(selectedCourse.id, 'totalYears', value)}
                    min={1}
                    max={10}
                  />
                  <NumberField
                    label="Semesters / Year"
                    value={
                      courseDrafts[selectedCourse.id]?.semestersPerYear ?? selectedCourse.semestersPerYear
                    }
                    onChange={(value) =>
                      updateCourseDraft(selectedCourse.id, 'semestersPerYear', value)
                    }
                    min={1}
                    max={4}
                  />
                  <div className="sm:col-span-3 flex gap-2">
                    <button
                      onClick={() => saveCourseEdits(selectedCourse.id)}
                      disabled={savingCourseId === selectedCourse.id}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => cancelEditCourse(selectedCourse.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Branches</h3>
                  <span className="text-xs text-gray-500">
                    {(branchesForSelectedCourse || []).filter((branch) => branch.isActive).length} active
                  </span>
                </div>

                <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm">
                  <p className="mb-3 font-semibold text-gray-900">Add branch</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <input
                      type="text"
                      value={branchForms[selectedCourse.id]?.name || ''}
                      onChange={(e) => updateBranchForm(selectedCourse.id, 'name', e.target.value)}
                      placeholder="Name"
                      className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={
                        branchForms[selectedCourse.id]?.totalYears ??
                        selectedCourse.totalYears
                      }
                      onChange={(e) =>
                        updateBranchForm(selectedCourse.id, 'totalYears', e.target.value)
                      }
                      placeholder="Years"
                      className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={
                        branchForms[selectedCourse.id]?.semestersPerYear ??
                        selectedCourse.semestersPerYear
                      }
                      onChange={(e) =>
                        updateBranchForm(selectedCourse.id, 'semestersPerYear', e.target.value)
                      }
                      placeholder="Sem / year"
                      className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleAddBranch(selectedCourse)}
                      disabled={savingBranchId === `new-${selectedCourse.id}`}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingBranchId === `new-${selectedCourse.id}` ? (
                        <LoadingAnimation width={14} height={14} showMessage={false} variant="inline" />
                      ) : (
                        <Plus size={14} />
                      )}
                      Add
                    </button>
                  </div>
                </div>

                {branchesLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <LoadingAnimation width={24} height={24} showMessage={false} />
                  </div>
                ) : branchesForSelectedCourse.length === 0 ? (
                  <p className="mt-4 text-sm text-gray-500">No branches yet. Add one to get started.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {branchesForSelectedCourse.map((branch) => {
                      const isEditing =
                        editingBranch &&
                        editingBranch.courseId === selectedCourse.id &&
                        editingBranch.branchId === branch.id;
                      const branchDraft = branchDrafts[branch.id] || branch;

                      return (
                        <div
                          key={branch.id}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={branchDraft.name}
                                    onChange={(e) =>
                                      updateBranchDraft(branch.id, 'name', e.target.value)
                                    }
                                    className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  <span className="font-medium text-gray-900">{branch.name}</span>
                                )}
                                {!branch.isActive && (
                                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                                    inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600">
                                {(branch.totalYears ?? selectedCourse.totalYears)} years ·{' '}
                                {(branch.semestersPerYear ?? selectedCourse.semestersPerYear)} semesters/year
                              </p>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs font-medium text-gray-600">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => saveBranchEdit(selectedCourse.id, branch)}
                                    disabled={savingBranchId === branch.id}
                                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditBranch}
                                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 hover:bg-gray-100"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() =>
                                      startEditBranch(selectedCourse.id, branch, selectedCourse)
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 hover:bg-gray-100"
                                  >
                                    <Pencil size={12} />
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteBranch(selectedCourse.id, branch)}
                                    disabled={savingBranchId === branch.id}
                                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 size={12} />
                                    Delete
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => toggleBranchActive(selectedCourse.id, branch)}
                                disabled={savingBranchId === branch.id}
                                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 hover:bg-gray-100 disabled:opacity-50"
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

                          {isEditing && (
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500">Years</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={branchDraft.totalYears ?? selectedCourse.totalYears}
                                  onChange={(e) =>
                                    updateBranchDraft(branch.id, 'totalYears', e.target.value)
                                  }
                                  className="w-20 rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500">Semesters / Year</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={4}
                                  value={
                                    branchDraft.semestersPerYear ?? selectedCourse.semestersPerYear
                                  }
                                  onChange={(e) =>
                                    updateBranchDraft(branch.id, 'semestersPerYear', e.target.value)
                                  }
                                  className="w-20 rounded-md border border-gray-300 px-2 py-1 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-sm text-gray-500">
              Select a course to manage its details.
            </div>
          )}
        </div>
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

const StatusBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
    }`}
  >
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const CourseCard = ({ course, isSelected, onSelect }) => {
  const activeBranches = (course.branches || []).filter((branch) => branch.isActive).length;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-4 text-left transition ${
        isSelected
          ? 'border-blue-500 bg-blue-50/60 shadow-sm'
          : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">{course.name}</span>
        <StatusBadge isActive={course.isActive} />
      </div>
      <p className="mt-1 text-xs text-gray-600">
        {course.totalYears} years · {course.semestersPerYear} semesters/year
      </p>
      <p className="mt-2 text-xs text-gray-500">{activeBranches} active branches</p>
    </button>
  );
};

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

