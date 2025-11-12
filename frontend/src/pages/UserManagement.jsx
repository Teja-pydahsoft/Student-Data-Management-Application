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
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../config/api';
import useAuthStore from '../store/authStore';

const initialFormState = {
  username: '',
  email: '',
  password: '',
  modules: []
};

const UserManagement = () => {
  const { user } = useAuthStore();
  const [operations, setOperations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [form, setForm] = useState(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ id: null, email: '', modules: [], password: '', isActive: true });
  const [updatingUser, setUpdatingUser] = useState(false);

  const activeUsersCount = useMemo(() => users.filter((user) => user.isActive).length, [users]);

  const loadOperations = async () => {
    setLoadingOperations(true);
    try {
      const response = await api.get('/users/operations');
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to load operations');
      }
      setOperations(response.data.data || []);
    } catch (error) {
      console.error('Failed to load operations:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to load operations');
    } finally {
      setLoadingOperations(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.get('/users');
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Unable to load users');
      }
      setUsers(response.data.data || []);
    } catch (error) {
      console.error('Failed to load staff users:', error);
      toast.error(error.response?.data?.message || error.message || 'Unable to load staff users');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') {
      loadOperations();
      loadUsers();
    }
  }, [user]);

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-white border border-red-200 text-red-600 rounded-xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold mb-2">Access Restricted</h1>
          <p className="text-sm">
            You do not have permission to manage staff accounts. Please contact an administrator if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setForm(initialFormState);
    setShowPassword(false);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const toggleModule = (moduleKey) => {
    setForm((prev) => {
      const modules = prev.modules.includes(moduleKey)
        ? prev.modules.filter((key) => key !== moduleKey)
        : [...prev.modules, moduleKey];
      return { ...prev, modules };
    });
  };

  const toggleEditModule = (moduleKey) => {
    setEditForm((prev) => {
      const modules = prev.modules.includes(moduleKey)
        ? prev.modules.filter((key) => key !== moduleKey)
        : [...prev.modules, moduleKey];
      return { ...prev, modules };
    });
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('All fields are required');
      return;
    }

    if (form.modules.length === 0) {
      toast.error('Assign at least one operation');
      return;
    }

    setCreatingUser(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        modules: form.modules,
        isActive: true
      };
      const response = await api.post('/users', payload);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to create user');
      }
      toast.success('Staff user created');
      resetForm();
      await loadUsers();
    } catch (error) {
      console.error('Failed to create staff user:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to create staff user');
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditForm({
      id: user.id,
      email: user.email,
      modules: user.modules || [],
      password: '',
      isActive: user.isActive
    });
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm({ id: null, email: '', modules: [], password: '', isActive: true });
    setUpdatingUser(false);
  };

  const handleUpdateUser = async (event) => {
    event.preventDefault();
    if (!editingUser) return;

    if (editForm.modules.length === 0) {
      toast.error('Assign at least one operation');
      return;
    }

    setUpdatingUser(true);
    try {
      const payload = {
        email: editForm.email.trim(),
        modules: editForm.modules,
        isActive: editForm.isActive
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const response = await api.put(`/users/${editingUser.id}`, payload);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update user');
      }

      toast.success('Staff user updated');
      closeEditModal();
      await loadUsers();
    } catch (error) {
      console.error('Failed to update staff user:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to update staff user');
    } finally {
      setUpdatingUser(false);
    }
  };

  const handleDeactivateUser = async (userId) => {
    try {
      await api.patch(`/users/${userId}/deactivate`);
      toast.success('User deactivated');
      await loadUsers();
    } catch (error) {
      console.error('Failed to deactivate staff user:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to deactivate user');
    }
  };

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
              Create staff accounts and assign operational access for daily workflows.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
            <div className="text-xs uppercase text-gray-500">Total Staff Users</div>
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
              <span>Create New Staff User</span>
            </div>
            <form className="p-5 space-y-4" onSubmit={handleCreateUser}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => handleFormChange('username', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="johndoe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleFormChange('email', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="john@example.com"
                  required
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => handleFormChange('password', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  placeholder="Enter a strong password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-purple-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Assigned Operations</label>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, modules: operations.map((op) => op.key) }))}
                    className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    disabled={operations.length === 0}
                  >
                    Select All
                  </button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {loadingOperations ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <RefreshCw className="animate-spin" size={16} />
                      Loading operations...
                    </div>
                  ) : (
                    operations.map((operation) => (
                      <label
                        key={operation.key}
                        className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-purple-500 hover:bg-purple-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.modules.includes(operation.key)}
                          onChange={() => toggleModule(operation.key)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{operation.label}</p>
                          <p className="text-xs text-gray-500">{operation.description}</p>
                        </div>
                      </label>
                    ))
                  )}
                  {!loadingOperations && operations.length === 0 && (
                    <p className="text-sm text-gray-500">No operations available.</p>
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
                <span>Assigned Staff</span>
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
                <p>No staff users found. Create one using the form.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Operations</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">{user.username}</span>
                            <span className="text-xs text-gray-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-2">
                            {(user.modules || []).map((moduleKey) => {
                              const meta = operations.find((operation) => operation.key === moduleKey);
                              return (
                                <span
                                  key={moduleKey}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                >
                                  <ShieldCheck size={12} />
                                  {meta?.label || moduleKey}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                              user.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                            }`}
                          >
                            <Power size={12} />
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(user)}
                              className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md border border-purple-500 text-purple-600 hover:bg-purple-50"
                            >
                              <Edit size={14} />
                              Edit
                            </button>
                            {user.isActive && (
                              <button
                                type="button"
                                onClick={() => handleDeactivateUser(user.id)}
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

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 text-purple-600 rounded-full p-2">
                  <Lock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Update Staff User</h2>
                  <p className="text-sm text-gray-500">Adjust operations and credentials for {editingUser.username}</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={editingUser.username}
                    disabled
                    className="w-full rounded-md border border-gray-200 px-3 py-2 bg-gray-100 text-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={editForm.password}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, password: event.target.value }))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    placeholder="Leave blank to keep existing password"
                  />
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <input
                    id="user-active"
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label htmlFor="user-active" className="text-sm text-gray-700 font-medium">
                    Active
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Operations</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {operations.map((operation) => (
                    <label
                      key={operation.key}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2 hover:border-purple-500 hover:bg-purple-50"
                    >
                      <input
                        type="checkbox"
                        checked={editForm.modules.includes(operation.key)}
                        onChange={() => toggleEditModule(operation.key)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{operation.label}</p>
                        <p className="text-xs text-gray-500">{operation.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
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


