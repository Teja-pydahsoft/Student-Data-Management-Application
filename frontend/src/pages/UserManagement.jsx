import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users as UsersIcon,
  RefreshCw,
  Edit,
  Power,
  X,
  Building2,
  GraduationCap,
  BookOpen,
  Search,
  User,
  Settings,
  Layers,
  CheckCircle2,
  XCircle,
  Check,
  Mail,
  Phone,
  AtSign,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Send,
  AlertCircle,
  KeyRound,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import useAuthStore from '../store/authStore';
import { ROLE_LABELS, ROLE_COLORS, isFullAccessRole, hasModuleAccess, BACKEND_MODULES, MODULE_PERMISSIONS, MODULE_LABELS, createDefaultPermissions } from '../constants/rbac';

const ROLE_AVATAR_COLORS = {
  college_principal: 'from-indigo-400 to-indigo-600',
  college_ao: 'from-sky-400 to-sky-600',
  college_attender: 'from-slate-400 to-slate-600',
  branch_hod: 'from-amber-400 to-amber-600',
  super_admin: 'from-rose-400 to-rose-600'
};

const ROLE_DESCRIPTIONS = {
  college_principal: 'Manages overall college operations and has oversight of all courses and branches',
  college_ao: 'Administrative officer responsible for college-level operations and record management',
  college_attender: 'Basic access for attendance tracking and daily record management',
  branch_hod: 'Head of Department with control over specific branches and their operations'
};

// Fixed roles list - only these 4 roles
const FIXED_ROLES = [
  { value: 'college_principal', label: 'College Principal' },
  { value: 'college_ao', label: 'College AO' },
  { value: 'college_attender', label: 'College Attender' },
  { value: 'branch_hod', label: 'Branch HOD' }
];

const initialFormState = {
  name: '',
  email: '',
  phone: '',
  username: '',
  password: '',
  role: '',
  collegeIds: [],
  courseIds: [],
  branchIds: [],
  allCourses: false,
  allBranches: false,
  permissions: {}
};

// Selection Modal Component
const SelectionModal = ({ 
  isOpen, 
  onClose, 
  title, 
  icon: Icon,
  options, 
  selectedIds, 
  onChange, 
  loading,
  searchPlaceholder = "Search...",
  colorScheme = "blue",
  displayKey = "name",
  allOption = null,
  allSelected = false,
  onAllChange = null,
  emptyMessage = "No options available"
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const colors = {
    blue: { 
      bg: 'bg-blue-600', 
      light: 'bg-blue-50', 
      text: 'text-blue-600', 
      border: 'border-blue-200',
      gradient: 'from-blue-600 to-indigo-600'
    },
    green: { 
      bg: 'bg-emerald-600', 
      light: 'bg-emerald-50', 
      text: 'text-emerald-600', 
      border: 'border-emerald-200',
      gradient: 'from-emerald-600 to-teal-600'
    },
    orange: { 
      bg: 'bg-orange-600', 
      light: 'bg-orange-50', 
      text: 'text-orange-600', 
      border: 'border-orange-200',
      gradient: 'from-orange-600 to-amber-600'
    }
  };
  const c = colors[colorScheme] || colors.blue;

  const filteredOptions = options.filter(opt => 
    (opt[displayKey] || opt.name).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(i => i !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = (e) => {
    e.preventDefault();
    onChange(options.map(o => o.id));
  };

  const clearAll = (e) => {
    e.preventDefault();
    onChange([]);
  };

  const handleAllOptionChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onAllChange) {
      onAllChange(!allSelected);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className={`bg-gradient-to-r ${c.gradient} px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-white/80">
                  {selectedIds.length} of {options.length} selected
                </p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
              />
            </div>
            <button 
              type="button"
              onClick={selectAll}
              className={`px-4 py-3 rounded-xl text-sm font-semibold ${c.light} ${c.text} hover:opacity-80 transition-all`}
            >
              Select All
            </button>
            <button 
              type="button"
              onClick={clearAll}
              className="px-4 py-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
            >
              Clear
            </button>
          </div>

          {allOption && onAllChange && (
            <div 
              onClick={handleAllOptionChange}
              className={`flex items-center gap-3 mt-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                allSelected 
                  ? `${c.light} ${c.border} ${c.text}` 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                allSelected ? `${c.bg} border-transparent` : 'border-slate-300'
              }`}>
                {allSelected && <Check size={14} className="text-white" />}
              </div>
              <div className="flex-1">
                <span className="font-semibold">{allOption}</span>
                <p className="text-xs text-slate-500 mt-0.5">Grant access to all items automatically</p>
              </div>
              <Sparkles size={18} className={allSelected ? c.text : 'text-slate-400'} />
            </div>
          )}
        </div>

        <div className="p-6 max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw size={32} className={`${c.text} animate-spin mb-3`} />
              <p className="text-slate-500">Loading options...</p>
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className={`w-16 h-16 ${c.light} rounded-2xl flex items-center justify-center mb-4`}>
                <Icon size={28} className={c.text} />
              </div>
              <p className="text-slate-500 font-medium">{emptyMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredOptions.map(option => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <div 
                    key={option.id}
                    onClick={(e) => !allSelected && handleToggle(option.id, e)}
                    className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${
                      isSelected 
                        ? `${c.light} ${c.border}` 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    } ${allSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? `${c.bg} border-transparent` : 'border-slate-300'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium block truncate ${isSelected ? c.text : 'text-slate-700'}`}>
                        {option[displayKey] || option.name}
                      </span>
                      {option.code && (
                        <span className="text-xs text-slate-500">{option.code}</span>
                      )}
                    </div>
                    {isSelected && <Check size={16} className={c.text} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            <span className="font-semibold">{selectedIds.length}</span> items selected
          </p>
          <button
            type="button"
            onClick={onClose}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white ${c.bg} hover:opacity-90 transition-all shadow-sm`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const { user } = useAuthStore();
  const [modules, setModules] = useState([]);
  const [users, setUsers] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [courses, setCourses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadingColleges, setLoadingColleges] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [updatingUser, setUpdatingUser] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('create');
  const [showPassword, setShowPassword] = useState(false);
  
  // Selection modal states
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  
  // Reset password modal states
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  
  // Delete user modal states
  const [deleteUserModal, setDeleteUserModal] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
  
  // Edit scope modal states
  const [showEditCollegeModal, setShowEditCollegeModal] = useState(false);
  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [showEditBranchModal, setShowEditBranchModal] = useState(false);
  const [editCourses, setEditCourses] = useState([]);
  const [editBranches, setEditBranches] = useState([]);
  const [loadingEditCourses, setLoadingEditCourses] = useState(false);
  const [loadingEditBranches, setLoadingEditBranches] = useState(false);

  const hasUserManagementAccess = useMemo(() => {
    if (isFullAccessRole(user?.role)) return true;
    if (user?.permissions) {
      const perm = user.permissions[BACKEND_MODULES.USER_MANAGEMENT];
      return perm && (perm.read || perm.write);
    }
    return false;
  }, [user]);

  const initializePermissions = useCallback(() => {
    return createDefaultPermissions();
  }, []);

  const loadModules = async () => {
    setLoadingModules(true);
    try {
      const response = await api.get('/rbac/users/modules');
      if (response.data?.success) setModules(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load modules');
    } finally {
      setLoadingModules(false);
    }
  };

  const loadColleges = async () => {
    setLoadingColleges(true);
    try {
      const response = await api.get('/colleges?includeInactive=false');
      if (response.data?.success) setColleges(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load colleges');
    } finally {
      setLoadingColleges(false);
    }
  };

  const loadCourses = async (collegeIds) => {
    if (!collegeIds || collegeIds.length === 0) {
      setCourses([]);
      return;
    }
    setLoadingCourses(true);
    try {
      const coursePromises = collegeIds.map(id => api.get(`/colleges/${id}/courses?includeInactive=false`));
      const responses = await Promise.all(coursePromises);
      const allCourses = responses.flatMap((response) => (response.data?.data || []));
      const uniqueCourses = allCourses.reduce((acc, course) => {
        if (!acc.find(c => c.id === course.id)) acc.push(course);
        return acc;
      }, []);
      setCourses(uniqueCourses);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const loadBranches = async (courseIds, coursesList = courses) => {
    if (!courseIds || courseIds.length === 0) {
      setBranches([]);
      return;
    }
    setLoadingBranches(true);
    try {
      const branchPromises = courseIds.map(id => api.get(`/courses/${id}/branches?includeInactive=false`));
      const responses = await Promise.all(branchPromises);
      
      const courseMap = {};
      coursesList.forEach(c => { courseMap[c.id] = c.name; });
      
      const allBranches = responses.flatMap((response, idx) =>
        (response.data?.data || []).map(branch => ({
          ...branch,
          courseId: courseIds[idx],
          courseName: courseMap[courseIds[idx]] || '',
          displayName: `${branch.name} (${courseMap[courseIds[idx]] || 'Course'})`
        }))
      );
      
      // Deduplicate branches by name and course
      const uniqueBranchesMap = new Map();
      allBranches.forEach(branch => {
        const key = `${branch.name}-${branch.courseId}`;
        if (!uniqueBranchesMap.has(key)) {
          uniqueBranchesMap.set(key, branch);
        }
      });
      
      const uniqueBranches = Array.from(uniqueBranchesMap.values());
      setBranches(uniqueBranches);
    } catch (error) {
      toast.error('Failed to load branches');
    } finally {
      setLoadingBranches(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get('/rbac/users');
      if (response.data?.success) setUsers(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  // Load courses for edit modal
  const loadEditCourses = async (collegeIds) => {
    if (!collegeIds || collegeIds.length === 0) {
      setEditCourses([]);
      return;
    }
    setLoadingEditCourses(true);
    try {
      const coursePromises = collegeIds.map(id => api.get(`/colleges/${id}/courses?includeInactive=false`));
      const responses = await Promise.all(coursePromises);
      const allCourses = responses.flatMap((response) => (response.data?.data || []));
      const uniqueCourses = allCourses.reduce((acc, course) => {
        if (!acc.find(c => c.id === course.id)) acc.push(course);
        return acc;
      }, []);
      setEditCourses(uniqueCourses);
    } catch (error) {
      toast.error('Failed to load courses');
    } finally {
      setLoadingEditCourses(false);
    }
  };

  // Load branches for edit modal
  const loadEditBranches = async (courseIds, coursesList = editCourses) => {
    if (!courseIds || courseIds.length === 0) {
      setEditBranches([]);
      return;
    }
    setLoadingEditBranches(true);
    try {
      const branchPromises = courseIds.map(id => api.get(`/courses/${id}/branches?includeInactive=false`));
      const responses = await Promise.all(branchPromises);
      
      const courseMap = {};
      coursesList.forEach(c => { courseMap[c.id] = c.name; });
      
      const allBranches = responses.flatMap((response, idx) =>
        (response.data?.data || []).map(branch => ({
          ...branch,
          courseId: courseIds[idx],
          courseName: courseMap[courseIds[idx]] || '',
          displayName: `${branch.name} (${courseMap[courseIds[idx]] || 'Course'})`
        }))
      );
      
      const uniqueBranchesMap = new Map();
      allBranches.forEach(branch => {
        const key = `${branch.name}-${branch.courseId}`;
        if (!uniqueBranchesMap.has(key)) {
          uniqueBranchesMap.set(key, branch);
        }
      });
      
      const uniqueBranches = Array.from(uniqueBranchesMap.values());
      setEditBranches(uniqueBranches);
    } catch (error) {
      toast.error('Failed to load branches');
    } finally {
      setLoadingEditBranches(false);
    }
  };

  useEffect(() => {
    if (hasUserManagementAccess) {
      loadModules();
      loadColleges();
      loadUsers();
    }
  }, [hasUserManagementAccess]);

  useEffect(() => {
    const perms = initializePermissions();
    setForm(prev => ({ ...prev, permissions: perms }));
  }, [initializePermissions]);

  useEffect(() => {
    if (form.collegeIds.length > 0) {
      loadCourses(form.collegeIds);
    } else {
      setCourses([]);
      setBranches([]);
    }
    setForm(prev => ({ ...prev, courseIds: [], branchIds: [], allCourses: false, allBranches: false }));
  }, [form.collegeIds]);

  useEffect(() => {
    if (form.courseIds.length > 0 && !form.allCourses) {
      loadBranches(form.courseIds, courses);
    } else {
      setBranches([]);
    }
    setForm(prev => ({ ...prev, branchIds: [], allBranches: false }));
  }, [form.courseIds, form.allCourses]);

  if (!hasUserManagementAccess) {
    return (
      <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50">
        <div className="bg-white border border-blue-200 text-blue-700 rounded-xl p-8 shadow-sm max-w-md text-center">
          <XCircle size={48} className="mx-auto mb-4 text-blue-400" />
          <h1 className="text-xl font-bold mb-2 text-slate-800">Access Restricted</h1>
          <p className="text-sm text-slate-600">You do not have permission to manage users.</p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    const perms = initializePermissions();
    setForm({ ...initialFormState, permissions: perms });
    setCourses([]);
    setBranches([]);
    setShowPassword(false);
  };

  const handleFormChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleEditPermission = (moduleKey, permissionKey) => {
    setEditForm(prev => {
      const currentModulePerms = prev.permissions[moduleKey] || {};
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: {
            ...currentModulePerms,
            [permissionKey]: !currentModulePerms[permissionKey]
          }
        }
      };
    });
  };

  // Toggle all permissions for a module
  const toggleModuleAllPermissions = (moduleKey, grant) => {
    const modulePerms = MODULE_PERMISSIONS[moduleKey];
    if (!modulePerms) return;
    
    setEditForm(prev => {
      const newPerms = {};
      modulePerms.permissions.forEach(perm => {
        newPerms[perm] = grant;
      });
      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          [moduleKey]: newPerms
        }
      };
    });
  };

  // Check if module has any permission enabled
  const hasAnyModulePermission = (moduleKey) => {
    const perms = editForm?.permissions?.[moduleKey];
    if (!perms) return false;
    return Object.values(perms).some(val => val === true);
  };

  // Count enabled permissions for a module
  const countModulePermissions = (moduleKey) => {
    const perms = editForm?.permissions?.[moduleKey];
    if (!perms) return { enabled: 0, total: 0 };
    const modulePerms = MODULE_PERMISSIONS[moduleKey];
    const total = modulePerms?.permissions?.length || 0;
    const enabled = Object.values(perms).filter(val => val === true).length;
    return { enabled, total };
  };

  // Grant all permissions
  const grantAllPermissions = () => {
    const allPerms = {};
    Object.keys(BACKEND_MODULES).forEach(key => {
      const moduleKey = BACKEND_MODULES[key];
      const modulePerms = MODULE_PERMISSIONS[moduleKey];
      if (modulePerms) {
        allPerms[moduleKey] = {};
        modulePerms.permissions.forEach(perm => {
          allPerms[moduleKey][perm] = true;
        });
      }
    });
    setEditForm(prev => ({ ...prev, permissions: allPerms }));
  };

  // Revoke all permissions
  const revokeAllPermissions = () => {
    setEditForm(prev => ({ ...prev, permissions: createDefaultPermissions() }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.username || !form.role || !form.password) {
      toast.error('Please fill all required fields including password');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (form.collegeIds.length === 0) {
      toast.error('Please select at least one college');
      return;
    }

    setCreatingUser(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone?.trim() || null,
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        collegeIds: form.collegeIds,
        courseIds: form.allCourses ? [] : form.courseIds,
        branchIds: form.allBranches ? [] : form.branchIds,
        allCourses: form.allCourses,
        allBranches: form.allBranches,
        permissions: initializePermissions(),
        sendCredentials: true // Always send credentials
      };

      const response = await api.post('/rbac/users', payload);
      if (response.data?.success) {
        if (response.data?.emailSent) {
          toast.success('User created and credentials sent to email!');
        } else {
          // User created but email failed
          const emailError = response.data?.emailError || 'Unknown error';
          toast.warning(`User created successfully, but email notification failed: ${emailError}`, {
            duration: 5000
          });
        }
        resetForm();
        await loadUsers();
        setActiveTab('users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditModal = async (userData) => {
    setEditingUser(userData);
    setEditForm({
      id: userData.id,
      name: userData.name,
      username: userData.username || '',
      email: userData.email,
      phone: userData.phone || '',
      role: userData.role,
      collegeIds: userData.collegeIds || (userData.collegeId ? [userData.collegeId] : []),
      courseIds: userData.courseIds || (userData.courseId ? [userData.courseId] : []),
      branchIds: userData.branchIds || (userData.branchId ? [userData.branchId] : []),
      allCourses: userData.allCourses || false,
      allBranches: userData.allBranches || false,
      permissions: userData.permissions || {},
      isActive: userData.isActive
    });
    
    const collegeIds = userData.collegeIds || (userData.collegeId ? [userData.collegeId] : []);
    const courseIds = userData.courseIds || (userData.courseId ? [userData.courseId] : []);
    
    // Load courses and branches for edit modal
    if (collegeIds.length > 0) {
      await loadEditCourses(collegeIds);
    }
    if (courseIds.length > 0 && !userData.allCourses) {
      // Wait a bit for courses to load then load branches
      setTimeout(async () => {
        await loadEditBranches(courseIds);
      }, 100);
    }
  };

  // Handle edit form college change
  const handleEditCollegeChange = async (newCollegeIds) => {
    setEditForm(prev => ({ 
      ...prev, 
      collegeIds: newCollegeIds,
      courseIds: [],
      branchIds: [],
      allCourses: false,
      allBranches: false
    }));
    setEditCourses([]);
    setEditBranches([]);
    if (newCollegeIds.length > 0) {
      await loadEditCourses(newCollegeIds);
    }
  };

  // Handle edit form course change
  const handleEditCourseChange = async (newCourseIds) => {
    setEditForm(prev => ({ 
      ...prev, 
      courseIds: newCourseIds,
      branchIds: [],
      allBranches: false
    }));
    setEditBranches([]);
    if (newCourseIds.length > 0) {
      await loadEditBranches(newCourseIds, editCourses);
    }
  };

  // Handle edit form all courses toggle
  const handleEditAllCoursesChange = (checked) => {
    setEditForm(prev => ({
      ...prev,
      allCourses: checked,
      courseIds: checked ? [] : prev.courseIds,
      allBranches: checked ? true : prev.allBranches,
      branchIds: checked ? [] : prev.branchIds
    }));
    if (checked) {
      setEditBranches([]);
    }
  };

  // Handle edit form all branches toggle
  const handleEditAllBranchesChange = (checked) => {
    setEditForm(prev => ({
      ...prev,
      allBranches: checked,
      branchIds: checked ? [] : prev.branchIds
    }));
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm(null);
    setEditCourses([]);
    setEditBranches([]);
    setShowEditCollegeModal(false);
    setShowEditCourseModal(false);
    setShowEditBranchModal(false);
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
        collegeIds: editForm.collegeIds,
        courseIds: editForm.allCourses ? [] : editForm.courseIds,
        branchIds: editForm.allBranches ? [] : editForm.branchIds,
        allCourses: editForm.allCourses,
        allBranches: editForm.allBranches,
        permissions: editForm.permissions,
        isActive: editForm.isActive
      };

      const response = await api.put(`/rbac/users/${editForm.id}`, payload);
      if (response.data?.success) {
        toast.success('User updated successfully!');
        closeEditModal();
        await loadUsers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Deactivate this user?')) return;
    try {
      const response = await api.delete(`/rbac/users/${userId}`);
      if (response.data?.success) {
        toast.success('User deactivated');
        await loadUsers();
      }
    } catch (error) {
      toast.error('Failed to deactivate user');
    }
  };

  // Delete User Functions
  const openDeleteModal = (userData) => {
    setDeleteUserModal(userData);
  };

  const closeDeleteModal = () => {
    setDeleteUserModal(null);
  };

  const handlePermanentDelete = async () => {
    if (!deleteUserModal) return;
    
    setDeletingUser(true);
    try {
      const response = await api.delete(`/rbac/users/${deleteUserModal.id}/permanent`);
      if (response.data?.success) {
        toast.success('User permanently deleted');
        closeDeleteModal();
        await loadUsers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUser(false);
    }
  };

  // Reset Password Functions
  const openResetPasswordModal = (userData) => {
    setResetPasswordUser(userData);
    setNewPassword('');
    setShowNewPassword(false);
  };

  const closeResetPasswordModal = () => {
    setResetPasswordUser(null);
    setNewPassword('');
    setShowNewPassword(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setResettingPassword(true);
    try {
      const response = await api.post(`/rbac/users/${resetPasswordUser.id}/reset-password`, {
        newPassword
      });
      if (response.data?.success) {
        toast.success(response.data.message || 'Password reset successfully!');
        closeResetPasswordModal();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const activeUsersCount = useMemo(() => users.filter(u => u.isActive).length, [users]);
  
  // Filter out super_admin from the list (only one super admin exists)
  const filteredUsers = useMemo(() => {
    let filtered = users.filter(u => u.role !== 'super_admin');
    if (userSearchTerm) {
      const term = userSearchTerm.toLowerCase();
      filtered = filtered.filter(u => 
        u.name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.username?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term)
      );
    }
    return filtered;
  }, [users, userSearchTerm]);

  // Check if user has any permissions configured
  const hasPermissions = (userData) => {
    if (!userData.permissions) return false;
    return Object.values(userData.permissions).some(modulePerms => {
      if (!modulePerms || typeof modulePerms !== 'object') return false;
      return Object.values(modulePerms).some(val => val === true);
    });
  };

  // Count granted permissions (modules with any permission enabled)
  const countPermissions = (userData) => {
    const totalModules = Object.keys(BACKEND_MODULES).length;
    if (!userData.permissions) return { granted: 0, total: totalModules };
    let granted = 0;
    Object.values(userData.permissions).forEach(modulePerms => {
      if (modulePerms && typeof modulePerms === 'object') {
        if (Object.values(modulePerms).some(val => val === true)) {
          granted++;
        }
      }
    });
    return { granted, total: totalModules };
  };

  const getSelectedNames = (items, ids, key = 'name') => {
    return items.filter(item => ids.includes(item.id)).map(item => item[key] || item.name);
  };

  const needsBranchSelection = form.role === 'branch_hod';

  return (
    <div className="w-full h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/25">
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">User Management</h1>
              <p className="text-sm text-slate-500">Create and manage users with role-based access</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-5 py-2.5 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl border border-blue-100">
              <div className="text-lg font-bold text-blue-600">{filteredUsers.length}</div>
              <div className="text-[11px] font-medium text-blue-500 uppercase tracking-wide">Total</div>
            </div>
            <div className="text-center px-5 py-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl border border-emerald-100">
              <div className="text-lg font-bold text-emerald-600">{filteredUsers.filter(u => u.isActive).length}</div>
              <div className="text-[11px] font-medium text-emerald-500 uppercase tracking-wide">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserPlus size={18} />
            Create User
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UsersIcon size={18} />
            All Users ({filteredUsers.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Create User Form */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateUser}>
            {/* Step Headers */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">User Information</h3>
                  <p className="text-xs text-slate-500">Basic details & credentials</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Role Selection</h3>
                  <p className="text-xs text-slate-500">Choose role</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Access Scope</h3>
                  <p className="text-xs text-slate-500">Set permissions</p>
                </div>
              </div>
            </div>

            {/* All 3 Sections Side by Side */}
            <div className="grid grid-cols-3 gap-6">
              {/* Section 1: User Information */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <User size={20} className="text-white" />
                    <h2 className="text-base font-bold text-white">User Information</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                      <User size={14} className="text-blue-500" />
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleFormChange('name', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                      <Mail size={14} className="text-blue-500" />
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      placeholder="email@example.com"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                        <AtSign size={14} className="text-blue-500" />
                        Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={(e) => handleFormChange('username', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="username"
                        required
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                        <Phone size={14} className="text-blue-500" />
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => handleFormChange('phone', e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="+91..."
                      />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                      <Lock size={14} className="text-blue-500" />
                      Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        placeholder="Enter password (min 6 chars)"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Role Selection */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={20} className="text-white" />
                    <h2 className="text-base font-bold text-white">Role Selection</h2>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  {FIXED_ROLES.map(role => {
                    const isSelected = form.role === role.value;
                    return (
                      <div 
                        key={role.value}
                        onClick={() => handleFormChange('role', role.value)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all border-2 ${
                          isSelected 
                            ? `${ROLE_COLORS[role.value]} border-current` 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${ROLE_AVATAR_COLORS[role.value]} flex items-center justify-center shadow-sm`}>
                          <ShieldCheck size={18} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-800">{role.label}</h4>
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {ROLE_DESCRIPTIONS[role.value]}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 bg-current rounded-full flex items-center justify-center flex-shrink-0">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Access Scope */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Layers size={20} className="text-white" />
                    <h2 className="text-base font-bold text-white">Access Scope</h2>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Colleges Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Building2 size={14} className="text-blue-500" />
                        Colleges <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {form.collegeIds.length} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCollegeModal(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100">
                        <Building2 size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {form.collegeIds.length > 0 ? (
                          <p className="font-medium text-slate-700 text-sm truncate">
                            {getSelectedNames(colleges, form.collegeIds).join(', ')}
                          </p>
                        ) : (
                          <p className="text-slate-400 text-sm">Click to select colleges</p>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Courses Selection */}
                  {form.collegeIds.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <GraduationCap size={14} className="text-emerald-500" />
                          Courses
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.allCourses}
                            onChange={(e) => {
                              handleFormChange('allCourses', e.target.checked);
                              if (e.target.checked) {
                                handleFormChange('courseIds', []);
                                handleFormChange('allBranches', true);
                                handleFormChange('branchIds', []);
                              }
                            }}
                            className="w-3 h-3 rounded text-emerald-500"
                          />
                          <span className="font-medium text-emerald-600">All</span>
                        </label>
                      </div>
                      {!form.allCourses ? (
                        <button
                          type="button"
                          onClick={() => setShowCourseModal(true)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group text-left"
                        >
                          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100">
                            <GraduationCap size={16} className="text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {form.courseIds.length > 0 ? (
                              <p className="font-medium text-slate-700 text-sm truncate">
                                {getSelectedNames(courses, form.courseIds).join(', ')}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-sm">Click to select courses</p>
                            )}
                          </div>
                        </button>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-700">All courses selected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Branches Selection */}
                  {(form.courseIds.length > 0 && !form.allCourses) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <BookOpen size={14} className="text-orange-500" />
                          Branches {needsBranchSelection && <span className="text-red-500">*</span>}
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.allBranches}
                            onChange={(e) => {
                              handleFormChange('allBranches', e.target.checked);
                              if (e.target.checked) handleFormChange('branchIds', []);
                            }}
                            className="w-3 h-3 rounded text-orange-500"
                          />
                          <span className="font-medium text-orange-600">All</span>
                        </label>
                      </div>
                      {!form.allBranches ? (
                        <button
                          type="button"
                          onClick={() => setShowBranchModal(true)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50/50 transition-all group text-left"
                        >
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100">
                            <BookOpen size={16} className="text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {form.branchIds.length > 0 ? (
                              <p className="font-medium text-slate-700 text-sm truncate">
                                {getSelectedNames(branches, form.branchIds, 'displayName').join(', ')}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-sm">Click to select branches</p>
                            )}
                          </div>
                        </button>
                      ) : (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-orange-500" />
                          <span className="text-sm font-medium text-orange-700">All branches selected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {form.collegeIds.length === 0 && (
                    <div className="text-center py-6">
                      <Layers size={32} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Select a college to configure access</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all"
              >
                <RefreshCw size={16} className="inline mr-2" />
                Reset
              </button>
              <button
                type="submit"
                disabled={creatingUser || !form.name || !form.email || !form.username || !form.role || !form.password || form.collegeIds.length === 0}
                className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 transition-all ${
                  creatingUser || !form.name || !form.email || !form.username || !form.role || !form.password || form.collegeIds.length === 0
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25'
                }`}
              >
                {creatingUser ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Users List */}
        {activeTab === 'users' && (
          <div className="w-full bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UsersIcon size={20} />
                All Users
              </h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-56 pl-10 pr-4 py-2.5 rounded-xl bg-white/20 text-white placeholder-white/60 text-sm focus:outline-none focus:bg-white/30 transition-all"
                  />
                </div>
                <button onClick={loadUsers} className="p-2.5 rounded-xl bg-white/20 text-white hover:bg-white/30 transition-colors">
                  <RefreshCw size={18} />
                </button>
              </div>
            </div>

            {loadingUsers ? (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
                <RefreshCw className="animate-spin" size={32} />
                <p className="text-sm font-medium">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 flex flex-col items-center gap-3 text-slate-400">
                <UsersIcon size={48} className="opacity-30" />
                <p className="text-sm font-medium">No users found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Scope</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Module Access</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((userData) => {
                      const permStatus = countPermissions(userData);
                      const hasModuleAccess = hasPermissions(userData);
                      return (
                        <tr key={userData.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_AVATAR_COLORS[userData.role] || 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                                {userData.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-800">{userData.name}</div>
                                <div className="text-xs text-slate-500">{userData.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${ROLE_COLORS[userData.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              <ShieldCheck size={12} />
                              {ROLE_LABELS[userData.role] || userData.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="space-y-1.5 text-xs">
                              {userData.collegeNames?.length > 0 && (
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <Building2 size={13} className="text-blue-500 flex-shrink-0" />
                                  <span className="truncate max-w-[150px]">
                                    {userData.collegeNames.map(c => c.name).join(', ')}
                                  </span>
                                </div>
                              )}
                              {userData.allCourses ? (
                                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-medium">
                                  All Courses
                                </span>
                              ) : userData.courseNames?.length > 0 && (
                                <div className="flex items-center gap-1.5 text-slate-600">
                                  <GraduationCap size={13} className="text-emerald-500 flex-shrink-0" />
                                  <span className="truncate max-w-[150px]">
                                    {userData.courseNames.map(c => c.name).join(', ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {hasModuleAccess ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold w-fit">
                                  <CheckCircle2 size={12} />
                                  Granted
                                </span>
                                <span className="text-[10px] text-slate-500">{permStatus.granted}/{permStatus.total} modules</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold w-fit">
                                  <AlertCircle size={12} />
                                  Pending
                                </span>
                                <span className="text-[10px] text-slate-500">Needs configuration</span>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {userData.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">
                                <CheckCircle2 size={12} />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-semibold">
                                <XCircle size={12} />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(userData)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
                                title="Edit User"
                              >
                                <Edit size={13} />
                                Edit
                              </button>
                              <button
                                onClick={() => openResetPasswordModal(userData)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 transition-colors"
                                title="Reset Password"
                              >
                                <KeyRound size={13} />
                                Reset
                              </button>
                              {userData.isActive ? (
                                <button
                                  onClick={() => handleDeactivateUser(userData.id)}
                                  className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                                  title="Deactivate User"
                                >
                                  <Power size={14} />
                                </button>
                              ) : null}
                              <button
                                onClick={() => openDeleteModal(userData)}
                                className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors"
                                title="Delete User Permanently"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selection Modals */}
      <SelectionModal
        isOpen={showCollegeModal}
        onClose={() => setShowCollegeModal(false)}
        title="Select Colleges"
        icon={Building2}
        options={colleges}
        selectedIds={form.collegeIds}
        onChange={(ids) => handleFormChange('collegeIds', ids)}
        loading={loadingColleges}
        searchPlaceholder="Search colleges..."
        colorScheme="blue"
        emptyMessage="No colleges available"
      />

      <SelectionModal
        isOpen={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title="Select Courses"
        icon={GraduationCap}
        options={courses}
        selectedIds={form.courseIds}
        onChange={(ids) => handleFormChange('courseIds', ids)}
        loading={loadingCourses}
        searchPlaceholder="Search courses..."
        colorScheme="green"
        allOption="All Courses"
        allSelected={form.allCourses}
        onAllChange={(val) => {
          handleFormChange('allCourses', val);
          if (val) {
            handleFormChange('courseIds', []);
            handleFormChange('allBranches', true);
            handleFormChange('branchIds', []);
          }
        }}
        emptyMessage="No courses available for selected colleges"
      />

      <SelectionModal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title="Select Branches"
        icon={BookOpen}
        options={branches}
        selectedIds={form.branchIds}
        onChange={(ids) => handleFormChange('branchIds', ids)}
        loading={loadingBranches}
        searchPlaceholder="Search branches..."
        colorScheme="orange"
        displayKey="displayName"
        allOption="All Branches"
        allSelected={form.allBranches}
        onAllChange={(val) => {
          handleFormChange('allBranches', val);
          if (val) handleFormChange('branchIds', []);
        }}
        emptyMessage="No branches available for selected courses"
      />

      {/* Edit Modal with Improved Permissions UI */}
      {editingUser && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit size={20} />
                Edit User - {editForm.name}
              </h2>
              <button onClick={closeEditModal} className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form className="flex-1 overflow-y-auto p-6" onSubmit={handleUpdateUser}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Info */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <User size={16} className="text-blue-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">User Details</h3>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Username</label>
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">
                      <AtSign size={14} className="text-slate-400" />
                      <span>{editForm.username || 'N/A'}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 block">Phone</label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all"
                    />
                  </div>
                  <div className={`p-4 rounded-xl border-2 ${ROLE_COLORS[editForm.role] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={18} />
                      <span className="font-bold">{ROLE_LABELS[editForm.role] || editForm.role}</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-5 h-5 rounded text-blue-600"
                    />
                    <span className="font-medium text-slate-700">Active User</span>
                  </label>
                </div>

                {/* Access Scope Edit */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Layers size={16} className="text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">Access Scope</h3>
                  </div>

                  {/* Colleges Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Building2 size={14} className="text-blue-500" />
                        Colleges <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {editForm.collegeIds.length} selected
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowEditCollegeModal(true)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 transition-all group text-left"
                    >
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100">
                        <Building2 size={16} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editForm.collegeIds.length > 0 ? (
                          <p className="font-medium text-slate-700 text-sm truncate">
                            {getSelectedNames(colleges, editForm.collegeIds).join(', ')}
                          </p>
                        ) : (
                          <p className="text-slate-400 text-sm">Click to select colleges</p>
                        )}
                      </div>
                      <Edit size={14} className="text-slate-400 group-hover:text-blue-500" />
                    </button>
                  </div>

                  {/* Courses Selection */}
                  {editForm.collegeIds.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <GraduationCap size={14} className="text-emerald-500" />
                          Courses
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.allCourses}
                            onChange={(e) => handleEditAllCoursesChange(e.target.checked)}
                            className="w-3 h-3 rounded text-emerald-500"
                          />
                          <span className="font-medium text-emerald-600">All</span>
                        </label>
                      </div>
                      {!editForm.allCourses ? (
                        <button
                          type="button"
                          onClick={() => setShowEditCourseModal(true)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group text-left"
                        >
                          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100">
                            <GraduationCap size={16} className="text-emerald-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {editForm.courseIds.length > 0 ? (
                              <p className="font-medium text-slate-700 text-sm truncate">
                                {getSelectedNames(editCourses, editForm.courseIds).join(', ')}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-sm">Click to select courses</p>
                            )}
                          </div>
                          <Edit size={14} className="text-slate-400 group-hover:text-emerald-500" />
                        </button>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <span className="text-sm font-medium text-emerald-700">All courses selected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Branches Selection */}
                  {(editForm.courseIds.length > 0 && !editForm.allCourses) && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <BookOpen size={14} className="text-orange-500" />
                          Branches
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.allBranches}
                            onChange={(e) => handleEditAllBranchesChange(e.target.checked)}
                            className="w-3 h-3 rounded text-orange-500"
                          />
                          <span className="font-medium text-orange-600">All</span>
                        </label>
                      </div>
                      {!editForm.allBranches ? (
                        <button
                          type="button"
                          onClick={() => setShowEditBranchModal(true)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-400 hover:bg-orange-50/50 transition-all group text-left"
                        >
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center group-hover:bg-orange-100">
                            <BookOpen size={16} className="text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {editForm.branchIds.length > 0 ? (
                              <p className="font-medium text-slate-700 text-sm truncate">
                                {getSelectedNames(editBranches, editForm.branchIds, 'displayName').join(', ')}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-sm">Click to select branches</p>
                            )}
                          </div>
                          <Edit size={14} className="text-slate-400 group-hover:text-orange-500" />
                        </button>
                      ) : (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-2">
                          <CheckCircle2 size={16} className="text-orange-500" />
                          <span className="text-sm font-medium text-orange-700">All branches selected</span>
                        </div>
                      )}
                    </div>
                  )}

                  {editForm.collegeIds.length === 0 && (
                    <div className="text-center py-6">
                      <Layers size={32} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">Select a college to configure access</p>
                    </div>
                  )}
                </div>

                {/* Improved Permissions UI */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Settings size={16} className="text-amber-500" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">Module Permissions</h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={grantAllPermissions}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        Grant All
                      </button>
                      <button
                        type="button"
                        onClick={revokeAllPermissions}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Revoke All
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                    {Object.keys(BACKEND_MODULES).map(key => {
                      const moduleKey = BACKEND_MODULES[key];
                      const modulePerms = MODULE_PERMISSIONS[moduleKey];
                      const moduleLabel = MODULE_LABELS[moduleKey];
                      if (!modulePerms) return null;
                      
                      const hasAny = hasAnyModulePermission(moduleKey);
                      const { enabled, total } = countModulePermissions(moduleKey);
                      
                      return (
                        <div 
                          key={moduleKey} 
                          className={`rounded-xl border-2 transition-all overflow-hidden ${
                            hasAny 
                              ? 'bg-emerald-50/30 border-emerald-200' 
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {/* Module Header */}
                          <div className="flex items-center justify-between p-3 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                                hasAny ? 'bg-emerald-100' : 'bg-slate-200'
                              }`}>
                                {hasAny ? (
                                  <CheckCircle2 size={14} className="text-emerald-600" />
                                ) : (
                                  <XCircle size={14} className="text-slate-400" />
                                )}
                              </div>
                              <span className={`text-sm font-bold ${hasAny ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {moduleLabel}
                              </span>
                              <span className="text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                                {enabled}/{total}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => toggleModuleAllPermissions(moduleKey, true)}
                                className="px-2 py-1 text-[10px] font-semibold bg-emerald-100 text-emerald-600 rounded hover:bg-emerald-200 transition-colors"
                              >
                                All
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleModuleAllPermissions(moduleKey, false)}
                                className="px-2 py-1 text-[10px] font-semibold bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                              >
                                None
                              </button>
                            </div>
                          </div>
                          
                          {/* Permissions Grid */}
                          <div className="p-3 grid grid-cols-2 gap-2">
                            {modulePerms.permissions.map(permKey => {
                              const isEnabled = editForm?.permissions?.[moduleKey]?.[permKey] || false;
                              const permLabel = modulePerms.labels[permKey] || permKey;
                              
                              return (
                                <label 
                                  key={permKey}
                                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all text-xs ${
                                    isEnabled 
                                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isEnabled}
                                    onChange={() => toggleEditPermission(moduleKey, permKey)}
                                    className="w-3.5 h-3.5 rounded text-emerald-500"
                                  />
                                  <span className="font-medium truncate">{permLabel}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-200 flex justify-end gap-3">
                <button type="button" onClick={closeEditModal} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingUser || editForm.collegeIds.length === 0}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 ${
                    updatingUser || editForm.collegeIds.length === 0 ? 'bg-blue-400 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-lg hover:shadow-blue-500/25'
                  }`}
                >
                  {updatingUser ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {updatingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scope Selection Modals */}
      <SelectionModal
        isOpen={showEditCollegeModal}
        onClose={() => setShowEditCollegeModal(false)}
        title="Edit Colleges"
        icon={Building2}
        options={colleges}
        selectedIds={editForm?.collegeIds || []}
        onChange={handleEditCollegeChange}
        loading={loadingColleges}
        searchPlaceholder="Search colleges..."
        colorScheme="blue"
        emptyMessage="No colleges available"
      />

      <SelectionModal
        isOpen={showEditCourseModal}
        onClose={() => setShowEditCourseModal(false)}
        title="Edit Courses"
        icon={GraduationCap}
        options={editCourses}
        selectedIds={editForm?.courseIds || []}
        onChange={handleEditCourseChange}
        loading={loadingEditCourses}
        searchPlaceholder="Search courses..."
        colorScheme="green"
        allOption="All Courses"
        allSelected={editForm?.allCourses || false}
        onAllChange={handleEditAllCoursesChange}
        emptyMessage="No courses available for selected colleges"
      />

      <SelectionModal
        isOpen={showEditBranchModal}
        onClose={() => setShowEditBranchModal(false)}
        title="Edit Branches"
        icon={BookOpen}
        options={editBranches}
        selectedIds={editForm?.branchIds || []}
        onChange={(ids) => setEditForm(prev => ({ ...prev, branchIds: ids }))}
        loading={loadingEditBranches}
        searchPlaceholder="Search branches..."
        colorScheme="orange"
        displayKey="displayName"
        allOption="All Branches"
        allSelected={editForm?.allBranches || false}
        onAllChange={handleEditAllBranchesChange}
        emptyMessage="No branches available for selected courses"
      />

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <KeyRound size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Reset Password</h2>
                  <p className="text-sm text-white/80">{resetPasswordUser.name}</p>
                </div>
              </div>
              <button onClick={closeResetPasswordModal} className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Password Reset Notice</p>
                    <p className="text-xs text-amber-700 mt-1">
                      A new password will be set for <strong>{resetPasswordUser.username}</strong> and sent to their email: <strong>{resetPasswordUser.email}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    <Lock size={16} className="text-amber-500" />
                    New Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
                      placeholder="Enter new password (min 6 chars)"
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">Password must be at least 6 characters</p>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                  <Send size={18} className="text-blue-500" />
                  <p className="text-sm text-blue-700">
                    New credentials will be sent to user's email automatically
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeResetPasswordModal} 
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={resettingPassword || !newPassword || newPassword.length < 6}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 ${
                    resettingPassword || !newPassword || newPassword.length < 6
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-lg hover:shadow-amber-500/25'
                  }`}
                >
                  {resettingPassword ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <KeyRound size={16} />
                      Reset & Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-red-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={22} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Delete User</h2>
                  <p className="text-sm text-white/80">Permanent action</p>
                </div>
              </div>
              <button onClick={closeDeleteModal} className="p-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-800">Warning: This action cannot be undone!</p>
                    <p className="text-xs text-rose-700 mt-1">
                      You are about to permanently delete the user account for:
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${ROLE_AVATAR_COLORS[deleteUserModal.role] || 'from-slate-400 to-slate-600'} flex items-center justify-center text-white font-bold text-lg shadow-sm`}>
                    {deleteUserModal.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{deleteUserModal.name}</div>
                    <div className="text-sm text-slate-500">@{deleteUserModal.username}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail size={12} className="text-slate-400" />
                    {deleteUserModal.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={12} className="text-slate-400" />
                    {ROLE_LABELS[deleteUserModal.role] || deleteUserModal.role}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={closeDeleteModal} 
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={deletingUser}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 ${
                    deletingUser
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-rose-500 to-red-600 hover:shadow-lg hover:shadow-rose-500/25'
                  }`}
                >
                  {deletingUser ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Permanently
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
