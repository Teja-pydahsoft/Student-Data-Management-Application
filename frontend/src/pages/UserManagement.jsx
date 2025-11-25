import React, { useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users as UsersIcon,
  RefreshCw,
  Edit,
  Eye,
  EyeOff,
  Lock,
  Power,
  X,
  Building2,
  GraduationCap,
  BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import useAuthStore from '../store/authStore';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  campus_principal: 'Campus Principal',
  college_ao: 'College AO',
  course_principal: 'Course Principal',
  course_ao: 'Course AO',
  hod: 'HOD'
};

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  username: '',
  role: '',
  collegeId: '',
  courseId: '',
  branchId: '',
  permissions: {}
};

const UserManagement = () => {
  const { user } = useAuthStore();
  const [modules, setModules] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if user has permission to access user management
  const hasUserManagementAccess = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'super_admin') return true;
    if (user?.permissions?.user_management?.read || user?.permissions?.user_management?.write) return true;
    return false;
  }, [user]);

  // Initialize permissions structure
  const initializePermissions = () => {
    const perms = {};
    modules.forEach(module => {
      perms[module.key] = { read: false, write: false };
    });
    return perms;
  };

  // Load available roles
  const loadAvailableRoles = async () => {
    setLoadingRoles(true);
    try {
      const response = await api.get('/rbac/users/roles/available');
      if (response.data?.success) {
        setAvailableRoles(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load roles:', error);
      toast.error('Failed to load available roles');
    } finally {
      setLoadingRoles(false);
    }
  };

  // Load modules
  const loadModules = async () => {
    setLoadingModules(true);
    try {
      const response = await api.get('/rbac/users/modules');
      if (response.data?.success) {
        setModules(response.data.data || []);
        // Initialize form permissions
        const perms = initializePermissions();
        setForm(prev => ({ ...prev, permissions: perms }));
      }
    } catch (error) {
      console.error('Failed to load modules:', error);
      toast.error('Failed to load modules');
    } finally {
      setLoadingModules(false);
    }
  };

  // Load colleges
  const loadColleges = async () => {
    setLoadingColleges(true);
    try {
      const response = await api.get('/colleges?includeInactive=false');
      if (response.data?.success) {
        setColleges(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load colleges:', error);
      toast.error('Failed to load colleges');
    } finally {
      setLoadingColleges(false);
    }
  };

  // Load courses for selected college
  const loadCourses = async (collegeId) => {
    if (!collegeId) {
      setCourses([]);
      return;
    }
    setLoadingCourses(true);
    try {
      const response = await api.get(`/colleges/${collegeId}/courses?includeInactive=false`);
      if (response.data?.success) {
        setCourses(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load courses:', error);
      toast.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  // Load branches for selected course
  const loadBranches = async (courseId) => {
    if (!courseId) {
      setBranches([]);
      return;
    }
    setLoadingBranches(true);
    try {
      const response = await api.get(`/courses/${courseId}/branches?includeInactive=false`);
      if (response.data?.success) {
        setBranches(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  // Load users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get('/rbac/users');
      if (response.data?.success) {
        setUsers(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (hasUserManagementAccess) {
      loadModules();
      loadAvailableRoles();
      loadColleges();
      loadUsers();
    }
  }, [hasUserManagementAccess]);

  // When role changes, reset college/course/branch and load appropriate data
  useEffect(() => {
    if (form.role) {
      if (form.role === 'super_admin') {
        setForm(prev => ({ ...prev, collegeId: '', courseId: '', branchId: '' }));
        setCourses([]);
        setBranches([]);
      } else if (form.role === 'campus_principal' || form.role === 'college_ao') {
        setForm(prev => ({ ...prev, courseId: '', branchId: '' }));
        setCourses([]);
        setBranches([]);
      } else if (form.role === 'course_principal' || form.role === 'course_ao') {
        setForm(prev => ({ ...prev, branchId: '' }));
        setBranches([]);
        if (form.collegeId) {
          loadCourses(form.collegeId);
        }
      } else if (form.role === 'hod') {
        if (form.collegeId && !form.courseId) {
          loadCourses(form.collegeId);
        }
        if (form.courseId) {
          loadBranches(form.courseId);
        }
      }
    }
  }, [form.role]);

  // When college changes, load courses
  useEffect(() => {
    if (form.collegeId && (form.role === 'course_principal' || form.role === 'course_ao' || form.role === 'hod')) {
      loadCourses(form.collegeId);
    }
  }, [form.collegeId]);

  // When course changes, load branches
  useEffect(() => {
    if (form.courseId && form.role === 'hod') {
      loadBranches(form.courseId);
    }
  }, [form.courseId]);

  if (!hasUserManagementAccess) {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 text-red-600 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Access Restricted</h1>
          <p className="text-sm">
            You do not have permission to manage users. Please contact an administrator if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    const perms = initializePermissions();
    setForm({ ...initialFormState, permissions: perms });
    setCourses([]);
    setBranches([]);
  };

  const handleFormChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const togglePermission = (moduleKey, permissionType) => {
    setForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [permissionType]: !prev.permissions[moduleKey]?.[permissionType]
        }
      }
    }));
  };

  const toggleEditPermission = (moduleKey, permissionType) => {
    setEditForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [moduleKey]: {
          ...prev.permissions[moduleKey],
          [permissionType]: !prev.permissions[moduleKey]?.[permissionType]
        }
      }
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    if (!form.name || !form.email || !form.username || !form.role) {
      toast.error('Name, email, username, and role are required');
      return;
    }

    // Validate role requirements
    if (form.role !== 'super_admin' && !form.collegeId) {
      toast.error('College is required for this role');
      return;
    }

    if ((form.role === 'course_principal' || form.role === 'course_ao' || form.role === 'hod') && !form.courseId) {
      toast.error('Course is required for this role');
      return;
    }

    if (form.role === 'hod' && !form.branchId) {
      toast.error('Branch is required for HOD role');
      return;
    }

    setCreatingUser(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || null,
        username: form.username.trim(),
        role: form.role,
        collegeId: form.collegeId || null,
        courseId: form.courseId || null,
        branchId: form.branchId || null,
        permissions: form.permissions
      };

      const response = await api.post('/rbac/users', payload);
      if (response.data?.success) {
        toast.success('User created successfully');
        if (response.data.password) {
          toast.success(`Generated password: ${response.data.password}`, { duration: 10000 });
        }
        resetForm();
        await loadUsers();
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditModal = (userData) => {
    setEditingUser(userData);
    setEditForm({
      id: userData.id,
      name: userData.name,
      email: userData.email,
      phone: userData.phone || '',
      role: userData.role,
      collegeId: userData.collegeId || '',
      courseId: userData.courseId || '',
      branchId: userData.branchId || '',
      permissions: userData.permissions || {},
      isActive: userData.isActive
    });
    // Load courses and branches if needed
    if (userData.collegeId) {
      loadCourses(userData.collegeId);
    }
    if (userData.courseId) {
      loadBranches(userData.courseId);
    }
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm(null);
    setCourses([]);
    setBranches([]);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editForm) return;

    setUpdatingUser(true);
    try {
      const payload = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone?.trim() || null,
        role: editForm.role,
        collegeId: editForm.collegeId || null,
        courseId: editForm.courseId || null,
        branchId: editForm.branchId || null,
        permissions: editForm.permissions,
        isActive: editForm.isActive
      };

      const response = await api.put(`/rbac/users/${editForm.id}`, payload);
      if (response.data?.success) {
        toast.success('User updated successfully');
        closeEditModal();
        await loadUsers();
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    try {
      const response = await api.delete(`/rbac/users/${userId}`);
      if (response.data?.success) {
        toast.success('User deactivated successfully');
        await loadUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      toast.error(error.response?.data?.message || 'Failed to deactivate user');
    }
  };

  const activeUsersCount = useMemo(() => users.filter(u => u.isActive).length, [users]);

  // Determine which fields to show based on role
  const showCollegeField = form.role && form.role !== 'super_admin';
  const showCourseField = form.role && ['course_principal', 'course_ao', 'hod'].includes(form.role);
  const showBranchField = form.role === 'hod';

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-purple-100 p-3 text-purple-600">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 heading-font">User Management</h1>
            <p className="text-sm text-gray-600">
              Create and manage users with role-based access control
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <div className="text-xs uppercase text-gray-500">Total Users</div>
            <div className="text-xl font-semibold text-gray-900">{users.length}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <div className="text-xs uppercase text-gray-500">Active</div>
            <div className="text-xl font-semibold text-green-600">{activeUsersCount}</div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2 text-gray-700 font-semibold">
              <UserPlus size={18} />
              <span>Create New User</span>
            </div>
            <form className="p-5 space-y-4" onSubmit={handleCreateUser}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => handleFormChange('username', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="johndoe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  value={form.role}
                  onChange={(e) => handleFormChange('role', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  required
                  disabled={loadingRoles}
                >
                  <option value="">Select Role</option>
                  {availableRoles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {showCollegeField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    College * <Building2 size={14} className="inline" />
                  </label>
                  <select
                    value={form.collegeId}
                    onChange={(e) => handleFormChange('collegeId', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                    disabled={loadingColleges}
                  >
                    <option value="">Select College</option>
                    {colleges.map(college => (
                      <option key={college.id} value={college.id}>
                        {college.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showCourseField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course * <GraduationCap size={14} className="inline" />
                  </label>
                  <select
                    value={form.courseId}
                    onChange={(e) => handleFormChange('courseId', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                    disabled={loadingCourses || !form.collegeId}
                  >
                    <option value="">Select Course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {showBranchField && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Branch * <BookOpen size={14} className="inline" />
                  </label>
                  <select
                    value={form.branchId}
                    onChange={(e) => handleFormChange('branchId', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                    disabled={loadingBranches || !form.courseId}
                  >
                    <option value="">Select Branch</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1 border border-gray-200 rounded-md p-3">
                  {loadingModules ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <RefreshCw className="animate-spin" size={16} />
                      Loading modules...
                    </div>
                  ) : (
                    modules.map(module => (
                      <div key={module.key} className="border-b border-gray-100 pb-2 last:border-0">
                        <div className="font-semibold text-sm text-gray-800 mb-1">{module.label}</div>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={form.permissions[module.key]?.read || false}
                              onChange={() => togglePermission(module.key, 'read')}
                              className="h-3 w-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>Read</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              checked={form.permissions[module.key]?.write || false}
                              onChange={() => togglePermission(module.key, 'write')}
                              className="h-3 w-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>Write</span>
                          </label>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingUser}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  creatingUser
                    ? 'bg-purple-300 text-white cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {creatingUser ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create User
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={16} />
                Reset Form
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-700 font-semibold">
                <UsersIcon size={18} />
                <span>All Users</span>
              </div>
              <button
                type="button"
                onClick={loadUsers}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
              >
                <RefreshCw size={15} />
                Refresh
              </button>
            </div>

            {loadingUsers ? (
              <div className="py-16 flex justify-center items-center gap-2 text-gray-500">
                <RefreshCw className="animate-spin" size={18} />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2 text-gray-500">
                <ShieldCheck size={32} />
                <p>No users found. Create one using the form.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">College</th>
                      <th className="px-5 py-3">Course</th>
                      <th className="px-5 py-3">Branch</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users.map((userData) => (
                      <tr key={userData.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{userData.name}</span>
                            <span className="text-xs text-gray-500">{userData.email}</span>
                            <span className="text-xs text-gray-400">{userData.username}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            <ShieldCheck size={12} />
                            {ROLE_LABELS[userData.role] || userData.role}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {userData.collegeName || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {userData.courseName || '-'}
                        </td>
                        <td className="px-5 py-3 text-sm text-gray-600">
                          {userData.branchName || '-'}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                              userData.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            <Power size={12} />
                            {userData.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(userData)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md border border-purple-500 text-purple-600 hover:bg-purple-50"
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                            {userData.isActive && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(userData.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md border border-red-500 text-red-600 hover:bg-red-50"
                              >
                                <Power size={14} />
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      {editingUser && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 text-purple-600 rounded-full p-2">
                  <Lock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Update User</h2>
                  <p className="text-sm text-gray-500">Edit user details and permissions</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full p-2 hover:bg-gray-100 text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <form className="px-6 py-5 space-y-5" onSubmit={handleUpdateUser}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input
                    type="text"
                    value={ROLE_LABELS[editForm.role] || editForm.role}
                    disabled
                    className="w-full rounded-md border border-gray-200 px-3 py-2 bg-gray-100 text-gray-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 border border-gray-200 rounded-md p-3">
                  {modules.map(module => (
                    <div key={module.key} className="border-b border-gray-100 pb-2 last:border-0">
                      <div className="font-semibold text-sm text-gray-800 mb-1">{module.label}</div>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.permissions[module.key]?.read || false}
                            onChange={() => toggleEditPermission(module.key, 'read')}
                            className="h-3 w-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Read</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={editForm.permissions[module.key]?.write || false}
                            onChange={() => toggleEditPermission(module.key, 'write')}
                            className="h-3 w-3 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span>Write</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="user-active"
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="user-active" className="text-sm text-gray-700 font-medium">
                  Active
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingUser}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                    updatingUser
                      ? 'bg-purple-300 text-white cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {updatingUser ? (
                    <>
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
