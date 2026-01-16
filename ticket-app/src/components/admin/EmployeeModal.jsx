import React, { useState, useEffect } from 'react';
import {
    Search,
    X,
    Check,
    ChevronDown,
    ChevronRight,
    Folder,
    Layers,
    Target,
    Zap,
    User,
    Mail,
    Phone,
    Lock,
    Shield,
    Briefcase,
    UserCircle,
    ArrowRight,
    Hash
} from 'lucide-react';
import api from '../../config/api';

const EmployeeModal = ({
    isOpen,
    onClose,
    user: editingUser,
    activeRole,
    existingUsers,
    onSubmit,
    onCreateNewUser,
    isSubmitting
}) => {
    const [mode, setMode] = useState('select');
    const [userSearch, setUserSearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [expandedCategories, setExpandedCategories] = useState([]);
    const [formData, setFormData] = useState({
        rbac_user_id: null,
        role: 'staff',
        assigned_categories: [],
        assigned_subcategories: [],
        name: '',
        email: '',
        phone: '',
        username: '',
        password: ''
    });

    // Fetch categories
    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/complaint-categories');
            const data = response.data?.data || [];

            // Normalize the response - map sub_categories to subcategories
            const normalized = data.map(cat => ({
                ...cat,
                subcategories: cat.sub_categories || cat.subcategories || []
            }));

            setCategories(normalized);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setUserSearch('');

            if (editingUser) {
                setMode('edit');
                setFormData({
                    id: editingUser.id,
                    rbac_user_id: editingUser.rbac_user_id,
                    role: editingUser.role,
                    assigned_categories: editingUser.assigned_categories || [],
                    assigned_subcategories: editingUser.assigned_subcategories || []
                });
                // Expand categories that have selected subcategories
                const expandedIds = (editingUser.assigned_categories || []);
                setExpandedCategories(expandedIds);
            } else {
                setMode('select');
                const defaultRole = activeRole === 'worker' ? 'worker' : 'staff';
                setFormData({
                    rbac_user_id: null,
                    role: defaultRole,
                    assigned_categories: [],
                    assigned_subcategories: [],
                    name: '',
                    email: '',
                    phone: '',
                    username: '',
                    password: ''
                });
                setExpandedCategories([]);
            }
        }
    }, [isOpen, editingUser, activeRole]);

    const handleSubmit = () => {
        if (!formData.role) return;

        if (mode === 'create') {
            if (!formData.name || !formData.email || !formData.username || !formData.password) {
                return;
            }
            onCreateNewUser(formData);
        } else {
            const type = editingUser ? 'update' : 'assign';
            onSubmit(type, formData);
        }
    };

    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleCategoryToggle = (categoryId) => {
        setFormData(prev => {
            const isSelected = prev.assigned_categories.includes(categoryId);
            const newCategories = isSelected
                ? prev.assigned_categories.filter(id => id !== categoryId)
                : [...prev.assigned_categories, categoryId];

            // If deselecting category, remove all its subcategories
            let newSubcategories = prev.assigned_subcategories;
            if (isSelected) {
                const category = categories.find(c => c.id === categoryId);
                if (category && category.subcategories) {
                    const subcategoryIds = category.subcategories.map(sc => sc.id);
                    newSubcategories = newSubcategories.filter(id => !subcategoryIds.includes(id));
                }
            }

            return {
                ...prev,
                assigned_categories: newCategories,
                assigned_subcategories: newSubcategories
            };
        });
    };

    const handleSubcategoryToggle = (subcategoryId, parentId) => {
        setFormData(prev => {
            const isSelected = prev.assigned_subcategories.includes(subcategoryId);
            const newSubcategories = isSelected
                ? prev.assigned_subcategories.filter(id => id !== subcategoryId)
                : [...prev.assigned_subcategories, subcategoryId];

            // Ensure parent category is selected
            let newCategories = prev.assigned_categories;
            if (!isSelected && !newCategories.includes(parentId)) {
                newCategories = [...newCategories, parentId];
            }

            return {
                ...prev,
                assigned_categories: newCategories,
                assigned_subcategories: newSubcategories
            };
        });
    };

    if (!isOpen) return null;

    const mainCategories = categories.filter(c => !c.parent_id);

    return (
        <div className="modal-overlay">
            <div className="modal-content max-w-3xl animate-fade-in w-full">
                <div className="modal-header border-b border-gray-100 pb-4">
                    <h2 className="modal-title text-xl font-bold text-gray-800">
                        {editingUser ? 'Edit Employee' : 'Add Employee'}
                    </h2>
                    <button onClick={onClose} className="modal-close-btn p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="modal-body space-y-6 pt-6 px-1 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    {!editingUser ? (
                        <div className="bg-gray-100/50 p-1.5 rounded-2xl flex gap-1 mb-8 shadow-inner border border-gray-100">
                            <button
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${mode === 'select' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setMode('select')}
                            >
                                <UserCircle size={16} />
                                Select Existing
                            </button>
                            <button
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${mode === 'create' ? 'bg-white shadow-md text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setMode('create')}
                            >
                                <Zap size={16} />
                                Create New
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20 mb-8 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <UserCircle size={120} />
                            </div>
                            <div className="flex items-center gap-5 relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-2xl font-black border border-white/30">
                                    {(editingUser.name || 'E').charAt(0)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded">Editing Profile</span>
                                    </div>
                                    <h3 className="text-xl font-bold">{editingUser.name}</h3>
                                    <p className="text-blue-100 text-xs font-medium">{editingUser.email}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === 'select' && !editingUser && (
                        <div className="space-y-4 animate-fade-in">
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none group-focus-within:text-blue-500 text-gray-400 transition-colors">
                                    <Search size={18} />
                                </div>
                                <input
                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:outline-none transition-all text-sm font-bold shadow-sm"
                                    placeholder="Scan database for users..."
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {existingUsers?.filter(u =>
                                    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                    u.email?.toLowerCase().includes(userSearch.toLowerCase())
                                ).length > 0 ? (
                                    existingUsers.filter(u =>
                                        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                        u.email?.toLowerCase().includes(userSearch.toLowerCase())
                                    ).map(user => (
                                        <div
                                            key={user.id}
                                            onClick={() => setFormData({ ...formData, rbac_user_id: user.id })}
                                            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex items-center gap-4 ${formData.rbac_user_id === user.id ? 'border-blue-500 bg-blue-50' : 'border-gray-50 bg-white hover:border-blue-200'}`}
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${formData.rbac_user_id === user.id ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-900">{user.name}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase">{user.email}</div>
                                            </div>
                                            {formData.rbac_user_id === user.id ? (
                                                <Check size={20} strokeWidth={3} className="text-blue-600" />
                                            ) : (
                                                <ArrowRight size={16} className="text-gray-300" />
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-12 text-center opacity-40">
                                        <Search size={40} className="mx-auto mb-3" />
                                        <p className="text-sm font-bold">No matching users found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {mode === 'create' && !editingUser && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Identity Details</label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <User size={18} />
                                        </div>
                                        <input
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Enter Full Name"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">System Username</label>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors pt-6">
                                            <Hash size={18} />
                                        </div>
                                        <input
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold"
                                            value={formData.username}
                                            onChange={e => setFormData({ ...formData, username: e.target.value })}
                                            placeholder="johndoe"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Secure Password</label>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors pt-6">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold"
                                            value={formData.password}
                                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-5">
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Official Email</label>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors pt-6">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="email"
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold"
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="john@pydah.edu.in"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">Contact Number</label>
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors pt-6">
                                            <Phone size={18} />
                                        </div>
                                        <input
                                            type="tel"
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white focus:outline-none transition-all text-sm font-bold"
                                            value={formData.phone}
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            placeholder="+91 00000 00000"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Role Selection */}
                    <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-4 block">Deployment Role</label>
                        <div className="grid grid-cols-2 gap-4">
                            {(activeRole === 'all' || activeRole === 'staff') && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: 'staff' })}
                                    className={`p-4 rounded-3xl border-2 text-left transition-all duration-500 group relative overflow-hidden ${formData.role === 'staff' ? 'border-primary-blue bg-blue-50/50 ring-4 ring-blue-50' : 'border-gray-100 hover:border-blue-200'}`}
                                >
                                    {formData.role === 'staff' && <div className="absolute top-0 right-0 p-2 text-blue-500"><Check size={16} strokeWidth={4} /></div>}
                                    <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center transition-transform group-hover:scale-110 ${formData.role === 'staff' ? 'bg-primary-blue text-white shadow-lg shadow-blue-500/30' : 'bg-gray-100 text-gray-400'}`}>
                                        <Shield size={24} />
                                    </div>
                                    <h4 className={`font-black text-sm mb-1 ${formData.role === 'staff' ? 'text-blue-900' : 'text-gray-900'}`}>Manager</h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Strategic oversight</p>
                                </button>
                            )}

                            {(activeRole === 'all' || activeRole === 'worker') && (
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, role: 'worker' })}
                                    className={`p-4 rounded-3xl border-2 text-left transition-all duration-500 group relative overflow-hidden ${formData.role === 'worker' ? 'border-purple-500 bg-purple-50/50 ring-4 ring-purple-50' : 'border-gray-100 hover:border-purple-200'}`}
                                >
                                    {formData.role === 'worker' && <div className="absolute top-0 right-0 p-2 text-purple-500"><Check size={16} strokeWidth={4} /></div>}
                                    <div className={`w-12 h-12 rounded-2xl mb-3 flex items-center justify-center transition-transform group-hover:scale-110 ${formData.role === 'worker' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-gray-100 text-gray-400'}`}>
                                        <Briefcase size={24} />
                                    </div>
                                    <h4 className={`font-black text-sm mb-1 ${formData.role === 'worker' ? 'text-purple-900' : 'text-gray-900'}`}>Worker</h4>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Tactical execution</p>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Assignment - Only for Managers */}
                    {formData.role === 'staff' && (
                        <div className="animate-fade-in pt-4" style={{ animationDelay: '0.2s' }}>
                            <div className="flex items-center justify-between mb-4 px-1">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">
                                    Strategic Assignments
                                </label>
                                <div className="flex gap-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-100 uppercase">
                                        {formData.assigned_categories.length} Main
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] font-bold border border-purple-100 uppercase">
                                        {formData.assigned_subcategories.length} Sub
                                    </span>
                                </div>
                            </div>

                            <div className="category-tree-container">
                                {mainCategories.length > 0 ? (
                                    mainCategories.map(category => {
                                        const isExpanded = expandedCategories.includes(category.id);
                                        const isSelected = formData.assigned_categories.includes(category.id);
                                        const hasSubcategories = category.subcategories && category.subcategories.length > 0;

                                        return (
                                            <div key={category.id} className="main-category-block">
                                                {/* Vertical Tree Line */}
                                                {isExpanded && hasSubcategories && (
                                                    <div className="tree-line-vertical" />
                                                )}

                                                <div className={`main-category-card ${isSelected ? 'selected' : ''}`}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategory(category.id)}
                                                        className={`p-2 rounded-lg transition-all mr-2 ${isExpanded ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:bg-gray-50'}`}
                                                    >
                                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                    </button>

                                                    <label className="flex items-center flex-1 cursor-pointer">
                                                        <div className="category-icon-box">
                                                            <Folder size={20} strokeWidth={isSelected ? 2.5 : 2} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-bold text-gray-900 leading-none mb-1">{category.name}</h4>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Department Overseer</span>
                                                        </div>
                                                        <div className="relative">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleCategoryToggle(category.id)}
                                                                className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 transition-all cursor-pointer"
                                                            />
                                                            {isSelected && (
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <div className="w-2 h-2 bg-white rounded-full scale-50" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </label>
                                                </div>

                                                {/* Subcategories */}
                                                {isExpanded && hasSubcategories && (
                                                    <div className="subcategory-group">
                                                        {category.subcategories.map((sub) => {
                                                            const isSubSelected = formData.assigned_subcategories.includes(sub.id);
                                                            return (
                                                                <div key={sub.id} className="subcategory-item">
                                                                    <div className={`tree-line-horizontal ${isSubSelected ? 'tree-node-active' : ''}`} />

                                                                    <div className={`subcategory-card ${isSubSelected ? 'selected' : ''}`}>
                                                                        <label className="flex items-center flex-1 cursor-pointer gap-3">
                                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 group-hover:bg-white transition-all">
                                                                                <Target size={14} strokeWidth={isSubSelected ? 3 : 2} className={isSubSelected ? 'text-purple-600' : ''} />
                                                                            </div>
                                                                            <span className={`text-sm font-semibold ${isSubSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                                                                                {sub.name}
                                                                            </span>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSubSelected}
                                                                                onChange={() => handleSubcategoryToggle(sub.id, category.id)}
                                                                                className="hidden"
                                                                            />
                                                                        </label>
                                                                        {isSubSelected && (
                                                                            <div className="bg-purple-600 rounded-full p-0.5 shadow-lg shadow-purple-500/40">
                                                                                <Check size={12} className="text-white" strokeWidth={4} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-12 text-center bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center">
                                        <Layers className="text-gray-200 mb-4" size={48} strokeWidth={1} />
                                        <p className="text-sm font-bold text-gray-400 italic">No categories mapped to system</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer border-t border-gray-100 p-6 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (mode === 'select' && !editingUser && !formData.rbac_user_id)}
                        className="btn-primary w-full md:w-auto px-8 py-3 rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transform active:scale-95 transition-all text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create & Assign' : editingUser ? 'Update Employee' : 'Assign Employee'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmployeeModal;
