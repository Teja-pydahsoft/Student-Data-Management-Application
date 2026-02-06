/**
 * Admin – Faculty Management (Pydah v2.0)
 * Tabs: Employees, Assign HODs / Branches.
 */

import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { Users, Building2, UserCog, GraduationCap, X, UserPlus, ExternalLink, BookOpen, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const FacultyManagement = () => {
  const [tab, setTab] = useState('employees');
  const [employeeFilter, setEmployeeFilter] = useState('all'); // all | principals | aos | hods | faculty
  const [employees, setEmployees] = useState({ principals: [], hods: [], faculty: [], all: [] });
  const [colleges, setColleges] = useState([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [branchesWithHods, setBranchesWithHods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [employeeDetail, setEmployeeDetail] = useState(null);
  const [assignHodBranch, setAssignHodBranch] = useState(null);
  const [rbacUsers, setRbacUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [assigningHod, setAssigningHod] = useState(false);
  const [selectedHodUserId, setSelectedHodUserId] = useState('');
  const [assignHodMode, setAssignHodMode] = useState('select'); // 'select' | 'create'
  const [newHodName, setNewHodName] = useState('');
  const [newHodEmail, setNewHodEmail] = useState('');
  const [newHodUsername, setNewHodUsername] = useState('');
  const [newHodPassword, setNewHodPassword] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [branchYearSemDetail, setBranchYearSemDetail] = useState(null);
  const [yearSemData, setYearSemData] = useState({ yearSemList: [], assignmentsByKey: {}, subjects: [] });
  const [loadingYearSem, setLoadingYearSem] = useState(false);
  const [addingSubjectKey, setAddingSubjectKey] = useState('');
  const [newSubjectSelect, setNewSubjectSelect] = useState({});
  const [createSubjectForSem, setCreateSubjectForSem] = useState(null); // { year, semester, label } when open
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const empRes = await api.get('/faculty/employees');
        if (empRes.data.success) setEmployees(empRes.data.data || { principals: [], hods: [], faculty: [], all: [] });
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const res = await api.get('/colleges');
        if (res.data.success) setColleges(res.data.data || []);
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load colleges');
      }
    };
    if (tab === 'assign-hods') fetchColleges();
  }, [tab]);

  useEffect(() => {
    if (!selectedCollegeId || tab !== 'assign-hods') {
      setBranchesWithHods([]);
      return;
    }
    const fetchBranchesWithHods = async () => {
      try {
        setLoadingBranches(true);
        const res = await api.get(`/colleges/${selectedCollegeId}/branches-with-hods`);
        if (res.data.success) setBranchesWithHods(res.data.data || []);
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load branches');
        setBranchesWithHods([]);
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranchesWithHods();
  }, [selectedCollegeId, tab]);

  useEffect(() => {
    if (!assignHodBranch) return;
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const res = await api.get('/rbac/users');
        const data = res.data.data;
        setRbacUsers(Array.isArray(data) ? data : (data?.users || []));
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load users');
        setRbacUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [assignHodBranch]);

  useEffect(() => {
    if (!branchYearSemDetail) {
      setYearSemData({ yearSemList: [], assignmentsByKey: {}, subjects: [], branch: null });
      return;
    }
    const fetchYearSemSubjects = async () => {
      try {
        setLoadingYearSem(true);
        const res = await api.get(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`);
        if (res.data.success && res.data.data) {
          setYearSemData({
            yearSemList: res.data.data.yearSemList || [],
            assignmentsByKey: res.data.data.assignmentsByKey || {},
            subjects: res.data.data.subjects || [],
            branch: res.data.data.branch
          });
        }
      } catch (e) {
        toast.error(e.response?.data?.message || 'Failed to load year/sem subjects');
        setYearSemData({ yearSemList: [], assignmentsByKey: {}, subjects: [], branch: null });
      } finally {
        setLoadingYearSem(false);
      }
    };
    fetchYearSemSubjects();
  }, [branchYearSemDetail]);

  const getScopeDisplay = (e) => {
    const colleges = (e.collegeNames && e.collegeNames.length) ? e.collegeNames.map(c => c.name).join(', ') : (e.collegeName || '–');
    const courses = e.allCourses ? 'All' : ((e.courseNames && e.courseNames.length) ? e.courseNames.map(c => c.name).join(', ') : (e.courseName || '–'));
    const branches = e.allBranches ? 'All' : ((e.branchNames && e.branchNames.length) ? e.branchNames.map(b => b.name).join(', ') : (e.branchName || '–'));
    return { colleges, courses, branches };
  };

  const closeAssignHodModal = () => {
    setAssignHodBranch(null);
    setSelectedHodUserId('');
    setAssignHodMode('select');
    setNewHodName('');
    setNewHodEmail('');
    setNewHodUsername('');
    setNewHodPassword('');
  };

  const handleAssignHodSubmit = async () => {
    if (!assignHodBranch || !selectedHodUserId) {
      toast.error('Please select a user');
      return;
    }
    try {
      setAssigningHod(true);
      await api.post('/faculty/assign-hod', { branchId: assignHodBranch.id, userId: selectedHodUserId });
      toast.success(`HOD assigned to ${assignHodBranch.name}`);
      closeAssignHodModal();
      const res = await api.get(`/colleges/${selectedCollegeId}/branches-with-hods`);
      if (res.data.success) setBranchesWithHods(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to assign HOD');
    } finally {
      setAssigningHod(false);
    }
  };

  const handleAddSubjectToSem = async (year, semester, subjectId) => {
    if (!branchYearSemDetail || !subjectId) return;
    const key = `${year}-${semester}`;
    setAddingSubjectKey(key);
    try {
      await api.post(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`, { year, semester, subjectId });
      toast.success('Subject added');
      setNewSubjectSelect(prev => { const p = { ...prev }; delete p[key]; return p; });
      const res = await api.get(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`);
      if (res.data.success && res.data.data) {
        setYearSemData({
          yearSemList: res.data.data.yearSemList || [],
          assignmentsByKey: res.data.data.assignmentsByKey || {},
          subjects: res.data.data.subjects || [],
          branch: res.data.data.branch || yearSemData.branch
        });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add subject');
    } finally {
      setAddingSubjectKey('');
    }
  };

  const handleCreateSubjectForSem = async () => {
    const branch = yearSemData.branch;
    if (!branch || !branch.collegeId || !branch.courseId || !createSubjectForSem) return;
    const name = (newSubjectName || '').trim();
    if (!name) {
      toast.error('Subject name is required');
      return;
    }
    const { year, semester } = createSubjectForSem;
    setCreatingSubject(true);
    try {
      const createRes = await api.post('/subjects', {
        college_id: branch.collegeId,
        course_id: branch.courseId,
        branch_id: branch.id,
        name,
        code: (newSubjectCode || '').trim() || null
      });
      const subjectId = createRes.data?.data?.id;
      if (subjectId) {
        await api.post(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`, { year, semester, subjectId });
        toast.success(`Subject created and assigned to ${createSubjectForSem.label}`);
      } else {
        toast.success('Subject created');
      }
      setCreateSubjectForSem(null);
      setNewSubjectName('');
      setNewSubjectCode('');
      const res = await api.get(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`);
      if (res.data.success && res.data.data) {
        setYearSemData({
          yearSemList: res.data.data.yearSemList || [],
          assignmentsByKey: res.data.data.assignmentsByKey || {},
          subjects: res.data.data.subjects || [],
          branch: res.data.data.branch
        });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create subject');
    } finally {
      setCreatingSubject(false);
    }
  };

  const handleRemoveSubjectFromSem = async (year, semester, subjectId) => {
    if (!branchYearSemDetail) return;
    try {
      await api.delete(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`, {
        params: { year, semester, subjectId }
      });
      toast.success('Subject removed');
      const res = await api.get(`/faculty/branches/${branchYearSemDetail.id}/year-sem-subjects`);
      if (res.data.success && res.data.data) {
        setYearSemData({
          yearSemList: res.data.data.yearSemList || [],
          assignmentsByKey: res.data.data.assignmentsByKey || {},
          subjects: res.data.data.subjects || [],
          branch: res.data.data.branch || yearSemData.branch
        });
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to remove subject');
    }
  };

  const handleCreateHodSubmit = async () => {
    if (!assignHodBranch || !selectedCollegeId) return;
    const name = (newHodName || '').trim();
    const email = (newHodEmail || '').trim().toLowerCase();
    const username = (newHodUsername || '').trim();
    const password = newHodPassword;
    if (!name || !email || !username || !password) {
      toast.error('Name, email, username and password are required');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      setCreatingUser(true);
      await api.post('/rbac/users', {
        name,
        email,
        username,
        password,
        role: 'branch_hod',
        collegeIds: [Number(selectedCollegeId)],
        courseIds: [assignHodBranch.course_id].filter(Boolean),
        branchIds: [assignHodBranch.id]
      });
      toast.success(`HOD "${name}" created and assigned to ${assignHodBranch.name}. They will appear in User Management.`);
      closeAssignHodModal();
      const res = await api.get(`/colleges/${selectedCollegeId}/branches-with-hods`);
      if (res.data.success) setBranchesWithHods(res.data.data || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to create HOD user');
    } finally {
      setCreatingUser(false);
    }
  };

  // Filtered list for Employees tab (by sub-tab)
  const getFilteredEmployeeList = () => {
    const all = employees.all || [];
    if (employeeFilter === 'all') return all;
    if (employeeFilter === 'principals') return (employees.principals || []).filter(p => (p.role || '').toLowerCase() === 'college_principal');
    if (employeeFilter === 'aos') return (employees.principals || []).filter(p => (p.role || '').toLowerCase() === 'college_ao');
    if (employeeFilter === 'hods') return employees.hods || [];
    if (employeeFilter === 'faculty') return employees.faculty || [];
    return all;
  };
  const filteredEmployees = getFilteredEmployeeList();

  const tabs = [
    { id: 'employees', label: 'Employees', icon: UserCog },
    { id: 'assign-hods', label: 'Assign HODs / Branches', icon: Building2 }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page header */}
        <header className="mb-6 lg:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Faculty Management</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Principals, HODs & faculty · Assign branches · Create users in User Management
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 lg:mb-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                tab === id
                  ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/25 scale-[1.02]'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 font-medium">Loading faculty data…</p>
            </div>
          </div>
        ) : (
          <>
            {/* Employees tab – with sub-tabs: All, Principals, AOs, HODs, Faculty */}
            {tab === 'employees' && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Filter by role</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'all', label: 'All', count: (employees.all || []).length },
                        { id: 'principals', label: 'Principals', count: (employees.principals || []).filter(p => (p.role || '').toLowerCase() === 'college_principal').length },
                        { id: 'aos', label: 'AOs', count: (employees.principals || []).filter(p => (p.role || '').toLowerCase() === 'college_ao').length },
                        { id: 'hods', label: 'HODs', count: (employees.hods || []).length },
                        { id: 'faculty', label: 'Faculty', count: (employees.faculty || []).length }
                      ].map(({ id, label, count }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setEmployeeFilter(id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                            employeeFilter === id
                              ? 'bg-indigo-600 text-white shadow-md'
                              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          {label}
                          <span className={`px-1.5 py-0.5 rounded-md text-xs font-bold ${employeeFilter === id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                            {count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                    {filteredEmployees.length === 0 ? (
                      <p className="py-12 text-center text-slate-500 text-sm">No employees in this category.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredEmployees.map((e) => {
                          const { colleges, courses, branches } = getScopeDisplay(e);
                          const branchList = e.allBranches ? ['All'] : (e.branchNames?.length ? e.branchNames.map(b => b.name) : (e.branchName ? [e.branchName] : ['–']));
                          const collegeList = e.collegeNames?.length ? e.collegeNames.map(c => c.name) : (e.collegeName ? [e.collegeName] : (colleges ? [colleges] : ['–']));
                          const courseList = e.allCourses ? ['All'] : (e.courseNames?.length ? e.courseNames.map(c => c.name) : (e.courseName ? [e.courseName] : (courses ? [courses] : ['–'])));
                          return (
                            <div
                              key={e.id}
                              onDoubleClick={() => setEmployeeDetail(e)}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                                  {e.roleLabel}
                                </span>
                              </div>
                              <h4 className="font-semibold text-slate-800 text-sm mb-0.5">{e.name}</h4>
                              <p className="text-xs text-slate-500 mb-3 break-all">{e.email}</p>
                              <div className="space-y-2 text-xs">
                                <div>
                                  <span className="text-slate-400 font-medium">Colleges</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {collegeList.slice(0, 2).map((c, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{c}</span>
                                    ))}
                                    {collegeList.length > 2 && <span className="text-slate-400">+{collegeList.length - 2}</span>}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-medium">Courses</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {courseList.slice(0, 2).map((c, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{c}</span>
                                    ))}
                                    {courseList.length > 2 && <span className="text-slate-400">+{courseList.length - 2}</span>}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-slate-400 font-medium">Branches</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {branchList.slice(0, 3).map((b, i) => (
                                      <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">{b}</span>
                                    ))}
                                    {branchList.length > 3 && <span className="text-slate-400">+{branchList.length - 3}</span>}
                                  </div>
                                </div>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-2">Double-click to view details</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Assign HODs tab – branches with HOD assigned or Pending */}
            {tab === 'assign-hods' && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select college</label>
                  <select
                    value={selectedCollegeId}
                    onChange={(e) => setSelectedCollegeId(e.target.value)}
                    className="w-full max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                  >
                    <option value="">— Select college —</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {!selectedCollegeId ? (
                  <div className="p-12 text-center text-slate-500 text-sm">Select a college to see branches and HOD assignment.</div>
                ) : loadingBranches ? (
                  <div className="p-12 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 text-sm">Loading branches…</p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6">
                    {branchesWithHods.length === 0 ? (
                      <p className="py-12 text-center text-slate-500 text-sm">No branches in this college.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {branchesWithHods.map((b) => (
                          <div
                            key={b.id}
                            onDoubleClick={(e) => { if (!e.target.closest('button')) setBranchYearSemDetail(b); }}
                            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className="font-semibold text-slate-800">{b.name}</h4>
                              <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                                {b.course_name || '–'}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                              {b.hod ? (
                                <div className="text-sm">
                                  <p className="font-medium text-slate-800">{b.hod.name}</p>
                                  {b.hod.email && (
                                    <p className="text-xs text-slate-500 break-all mt-0.5">{b.hod.email}</p>
                                  )}
                                  <p className="text-[10px] text-slate-400 mt-1">Double-click to manage subjects by sem</p>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setAssignHodBranch(b); setSelectedHodUserId(''); }}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-100 text-amber-800 text-sm font-semibold hover:bg-amber-200 transition-colors"
                                >
                                  Pending – Assign HOD
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Employee detail modal – open on double-click */}
        {employeeDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEmployeeDetail(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Employee details</h3>
                <button type="button" onClick={() => setEmployeeDetail(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {(() => {
                const { colleges, courses, branches } = getScopeDisplay(employeeDetail);
                return (
                  <div className="space-y-4 text-sm">
                    <p><span className="font-semibold text-slate-600">Name</span> {employeeDetail.name}</p>
                    <p><span className="font-semibold text-slate-600">Email</span> {employeeDetail.email}</p>
                    <p><span className="font-semibold text-slate-600">Role</span> {employeeDetail.roleLabel}</p>
                    <p><span className="font-semibold text-slate-600">College(s)</span> {colleges}</p>
                    <p><span className="font-semibold text-slate-600">Course(s)</span> {courses}</p>
                    <p><span className="font-semibold text-slate-600">Branch(es)</span> {branches}</p>
                    <a href="/admin/user-management" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-indigo-600 font-semibold hover:underline">
                      <ExternalLink className="w-4 h-4" /> Open in User Management
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Branch Year/Sem – subjects per semester (double-click branch card) */}
        {branchYearSemDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setBranchYearSemDetail(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  {branchYearSemDetail.name} – Subjects by year/sem
                </h3>
                <button type="button" onClick={() => setBranchYearSemDetail(null)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {loadingYearSem ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Loading…</p>
                </div>
              ) : yearSemData.yearSemList.length === 0 ? (
                <p className="py-8 text-center text-slate-500 text-sm">No current regular students in this branch. Year/sem list is built from enrolled regular students only.</p>
              ) : (
                <div className="space-y-4">
                  {yearSemData.yearSemList.map(({ year, semester, label }) => {
                    const key = `${year}-${semester}`;
                    const assigned = yearSemData.assignmentsByKey[key] || [];
                    const availableSubjects = (yearSemData.subjects || []).filter(
                      s => !assigned.some(a => a.subjectId === s.id)
                    );
                    const selectedId = newSubjectSelect[key] || '';
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                          <span>{label}</span>
                        </h4>
                        <div className="space-y-2">
                          {assigned.map((a) => (
                            <div key={a.subjectId} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-lg bg-white border border-slate-100">
                              <span className="text-sm text-slate-800">{a.subjectName}{a.subjectCode ? ` (${a.subjectCode})` : ''}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSubjectFromSem(year, semester, a.subjectId)}
                                className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Remove subject"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <div className="flex flex-wrap gap-2 pt-1 items-center">
                            {availableSubjects.length > 0 && (
                              <>
                                <select
                                  value={selectedId}
                                  onChange={(e) => setNewSubjectSelect(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 max-w-[200px]"
                                >
                                  <option value="">— Add existing —</option>
                                  {availableSubjects.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={!selectedId || addingSubjectKey === key}
                                  onClick={() => handleAddSubjectToSem(year, semester, selectedId)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  <Plus className="w-4 h-4" /> Add
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => { setCreateSubjectForSem({ year, semester, label }); setNewSubjectName(''); setNewSubjectCode(''); }}
                              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
                            >
                              <Plus className="w-4 h-4" /> Create subject for this sem
                            </button>
                          </div>
                          {assigned.length === 0 && availableSubjects.length === 0 && (
                            <p className="text-xs text-slate-400 mt-1">Add an existing subject or create one for this sem using the button above.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Create subject for this sem dialog (name + code) */}
              {createSubjectForSem && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setCreateSubjectForSem(null)}>
                  <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
                    <h4 className="text-base font-bold text-slate-800 mb-4">Create subject for {createSubjectForSem.label}</h4>
                    <p className="text-slate-600 text-sm mb-4">Add a new subject and assign it to <strong>{createSubjectForSem.label}</strong> only.</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Subject name *</label>
                        <input
                          type="text"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          placeholder="e.g. Data Structures"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Subject code (optional)</label>
                        <input
                          type="text"
                          value={newSubjectCode}
                          onChange={(e) => setNewSubjectCode(e.target.value)}
                          placeholder="e.g. CS201"
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setCreateSubjectForSem(null)}
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={creatingSubject || !newSubjectName.trim()}
                          onClick={handleCreateSubjectForSem}
                          className="flex-1 px-3 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {creatingSubject ? 'Creating…' : 'Create & assign'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign HOD dialog – select existing user or create new HOD here */}
        {assignHodBranch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={closeAssignHodModal}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">Assign HOD – {assignHodBranch.name}</h3>
                <button type="button" onClick={closeAssignHodModal} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAssignHodMode('select')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${assignHodMode === 'select' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Select existing user
                </button>
                <button
                  type="button"
                  onClick={() => setAssignHodMode('create')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${assignHodMode === 'create' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                >
                  Create new HOD
                </button>
              </div>

              {assignHodMode === 'select' ? (
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700">Select existing user</label>
                  {loadingUsers ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      Loading users…
                    </div>
                  ) : (
                    <select
                      value={selectedHodUserId}
                      onChange={(e) => setSelectedHodUserId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">— Select user —</option>
                      {rbacUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email || u.username})</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeAssignHodModal}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!selectedHodUserId || assigningHod}
                      onClick={handleAssignHodSubmit}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {assigningHod ? 'Assigning…' : 'Assign HOD'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-slate-600 text-sm">Create a new user with HOD role for branch <strong>{assignHodBranch.name}</strong>. They will appear in User Management.</p>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={newHodName}
                      onChange={(e) => setNewHodName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={newHodEmail}
                      onChange={(e) => setNewHodEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Username *</label>
                    <input
                      type="text"
                      value={newHodUsername}
                      onChange={(e) => setNewHodUsername(e.target.value)}
                      placeholder="Login username"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Password * (min 6 characters)</label>
                    <input
                      type="password"
                      value={newHodPassword}
                      onChange={(e) => setNewHodPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={closeAssignHodModal}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={creatingUser}
                      onClick={handleCreateHodSubmit}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {creatingUser ? 'Creating…' : 'Create & assign HOD'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacultyManagement;
