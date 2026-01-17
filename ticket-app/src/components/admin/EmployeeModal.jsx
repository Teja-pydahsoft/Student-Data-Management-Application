import React, { useState, useEffect } from 'react';
import {
    Search,
    X,
    Check,
    ChevronDown,
    ChevronRight,
    Folder,
    Target,
    User,
    Mail,
    Phone,
    Lock,
    Shield,
    Briefcase,
    UserCircle,
    ArrowRight,
    ArrowLeft,
    Hash,
    Zap,
    CheckCircle2
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
    const [currentStep, setCurrentStep] = useState(1);
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

    const totalSteps = formData.role === 'staff' ? 3 : 2;

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/complaint-categories');
            const data = response.data?.data || [];
            const normalized = data.map(cat => ({
                ...cat,
                subcategories: cat.sub_categories || cat.subcategories || []
            }));
            setCategories(normalized);
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setUserSearch('');
            setCurrentStep(1);

            if (editingUser) {
                setMode('edit');
                setFormData({
                    id: editingUser.id,
                    rbac_user_id: editingUser.rbac_user_id,
                    role: editingUser.role,
                    assigned_categories: editingUser.assigned_categories || [],
                    assigned_subcategories: editingUser.assigned_subcategories || []
                });
                setExpandedCategories(editingUser.assigned_categories || []);
                setCurrentStep(2);
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

    const canProceedToNextStep = () => {
        if (currentStep === 1) {
            if (mode === 'select') return formData.rbac_user_id !== null;
            if (mode === 'create') return formData.name && formData.email && formData.username && formData.password;
        }
        if (currentStep === 2) return formData.role !== null;
        return true;
    };

    const handleNext = () => {
        if (canProceedToNextStep() && currentStep < totalSteps) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
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

    const steps = [
        { number: 1, title: editingUser ? 'Employee Info' : 'Select User', icon: UserCircle },
        { number: 2, title: 'Assign Role', icon: Shield },
        ...(formData.role === 'staff' ? [{ number: 3, title: 'Assign Tasks', icon: Briefcase }] : [])
    ];

    return (
        <div className="employee-modal-overlay">
            <div className="employee-modal-container">
                {/* Header */}
                <div className="employee-modal-header">
                    <div>
                        <h2 className="employee-modal-title">{editingUser ? 'Edit Employee' : 'Add New Employee'}</h2>
                        <p className="employee-modal-subtitle">
                            {currentStep === 1 ? (editingUser ? 'Update basic information' : 'Select or create a user account') :
                                currentStep === 2 ? 'Assign a role to this employee' :
                                    'Configure category responsibilities'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="employee-modal-close-btn"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="employee-steps-container">
                    <div className="employee-steps-wrapper">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="step-item">
                                    <div
                                        className={`step-circle ${currentStep >= step.number ? 'active' : 'inactive'}`}
                                    >
                                        {currentStep > step.number ? <Check size={14} strokeWidth={3} /> : step.number}
                                    </div>
                                    <span
                                        className={`step-label ${currentStep >= step.number ? 'active' : 'inactive'}`}
                                    >
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className="step-connector">
                                        <div
                                            className="step-connector-progress"
                                            style={{ width: currentStep > step.number ? '100%' : '0%' }}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Body - Scrollable Area */}
                <div className="employee-modal-content custom-scrollbar">
                    {/* Step 1: Select/Create User */}
                    {currentStep === 1 && !editingUser && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Tab Switcher */}
                            <div className="user-type-switcher">
                                <div className="user-type-bg">
                                    <button
                                        className={`user-type-btn ${mode === 'select' ? 'active' : ''}`}
                                        onClick={() => setMode('select')}
                                    >
                                        Select Existing
                                    </button>
                                    <button
                                        className={`user-type-btn ${mode === 'create' ? 'active' : ''}`}
                                        onClick={() => setMode('create')}
                                    >
                                        Create New
                                    </button>
                                </div>
                            </div>

                            {mode === 'select' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '42rem', margin: '0 auto', width: '100%' }}>
                                    <div className="user-search-container">
                                        <div className="user-search-icon">
                                            <Search className="h-5 w-5" />
                                        </div>
                                        <input
                                            className="user-search-input"
                                            placeholder="Search database for users..."
                                            value={userSearch}
                                            onChange={e => setUserSearch(e.target.value)}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="user-list-grid custom-scrollbar">
                                        {existingUsers?.filter(u =>
                                            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                            u.email?.toLowerCase().includes(userSearch.toLowerCase())
                                        ).map(user => (
                                            <div
                                                key={user.id}
                                                onClick={() => setFormData({ ...formData, rbac_user_id: user.id })}
                                                className={`user-select-card ${formData.rbac_user_id === user.id ? 'selected' : ''}`}
                                            >
                                                <div className="user-avatar">
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-900)' }}>{user.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{user.email}</div>
                                                </div>
                                                <div className="user-check-indicator">
                                                    {formData.rbac_user_id === user.id && <Check size={12} style={{ color: 'white' }} strokeWidth={3} />}
                                                </div>
                                            </div>
                                        ))}
                                        {existingUsers?.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--gray-500)' }}>
                                                No users found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    {/* Section 1: Basic Information */}

                                    <div className="form-group-container">
                                        <h2 className="employee-section-title">
                                            <div className="employee-section-dot"></div>
                                            Basic Information
                                        </h2>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                                            {/* Full Name */}
                                            <div style={{ gridColumn: '1 / -1' }}>
                                                <label className="form-label">
                                                    Full Name <span style={{ color: 'var(--red-500)' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={formData.name}
                                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                    placeholder="Enter full name"
                                                />
                                            </div>

                                            {/* Email */}
                                            <div>
                                                <label className="form-label">
                                                    Email <span style={{ color: 'var(--red-500)' }}>*</span>
                                                </label>
                                                <input
                                                    type="email"
                                                    className="form-input"
                                                    value={formData.email}
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="john@example.com"
                                                />
                                            </div>

                                            {/* Phone */}
                                            <div>
                                                <label className="form-label">
                                                    Phone (Optional)
                                                </label>
                                                <input
                                                    type="tel"
                                                    className="form-input"
                                                    value={formData.phone}
                                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                    placeholder="+91 00000 00000"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Section 2: Account Credentials */}
                                    <div className="form-group-container">
                                        <h2 className="employee-section-title">
                                            <div className="employee-section-dot credentials"></div>
                                            Account Credentials
                                        </h2>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                                            {/* Username */}
                                            <div>
                                                <label className="form-label">
                                                    Username <span style={{ color: 'var(--red-500)' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                    placeholder="johndoe"
                                                    autoComplete="off"
                                                />
                                            </div>

                                            {/* Password */}
                                            <div>
                                                <label className="form-label">
                                                    Password <span style={{ color: 'var(--red-500)' }}>*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    placeholder="••••••••"
                                                    autoComplete="new-password"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 1: Editing User Info */}
                    {currentStep === 1 && editingUser && (
                        <div className="animate-fade-in">
                            <div className="edit-user-highlight">
                                <div className="edit-user-highlight-bg"></div>
                                <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ width: '5rem', height: '5rem', borderRadius: '1rem', backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.875rem', fontWeight: 'bold' }}>
                                        {(editingUser.name || 'E').charAt(0)}
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{editingUser.name}</h3>
                                        <p style={{ color: '#dbeafe', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Mail size={16} />
                                            {editingUser.email}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Role Selection */}
                    {currentStep === 2 && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <h3 className="employee-modal-title">Choose Role</h3>
                                <p className="employee-modal-subtitle">Select the access level for this employee</p>
                            </div>

                            <div className="role-select-grid">
                                {(activeRole === 'all' || activeRole === 'staff') && (
                                    <button
                                        onClick={() => setFormData({ ...formData, role: 'staff' })}
                                        className={`role-card role-staff ${formData.role === 'staff' ? 'active' : ''}`}
                                    >
                                        <div className="role-icon">
                                            <Shield size={28} />
                                        </div>
                                        <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--gray-900)', marginBottom: '0.5rem' }}>Manager</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', lineHeight: '1.625' }}>Full access to manage categories, assign tasks, and oversee workers.</p>

                                        {formData.role === 'staff' && (
                                            <div className="role-selection-check">
                                                <Check size={14} style={{ color: 'white' }} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                )}

                                {(activeRole === 'all' || activeRole === 'worker') && (
                                    <button
                                        onClick={() => setFormData({ ...formData, role: 'worker' })}
                                        className={`role-card role-worker ${formData.role === 'worker' ? 'active' : ''}`}
                                    >
                                        <div className="role-icon worker-icon-hover">
                                            <Briefcase size={28} />
                                        </div>
                                        <h4 style={{ fontWeight: 'bold', fontSize: '1.125rem', color: 'var(--gray-900)', marginBottom: '0.5rem' }}>Worker</h4>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', lineHeight: '1.625' }}>Limited access focused on completing assigned tasks and field work.</p>

                                        {formData.role === 'worker' && (
                                            <div className="role-selection-check">
                                                <Check size={14} style={{ color: 'white' }} strokeWidth={3} />
                                            </div>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Category Assignment (Managers Only) */}
                    {currentStep === 3 && formData.role === 'staff' && (
                        <div className="category-selection-container animate-fade-in">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--gray-900)' }}>Assign Categories</h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)' }}>Select categories for this manager</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: 'var(--primary-blue-light)', color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #bfdbfe' }}>
                                        {formData.assigned_categories.length} Categories
                                    </span>
                                    <span style={{ padding: '0.25rem 0.75rem', borderRadius: '9999px', backgroundColor: '#f3e8ff', color: '#9333ea', fontSize: '0.75rem', fontWeight: 'bold', border: '1px solid #e9d5ff' }}>
                                        {formData.assigned_subcategories.length} Subcategories
                                    </span>
                                </div>
                            </div>

                            <div className="category-list-box custom-scrollbar">
                                {mainCategories.map(category => {
                                    const isExpanded = expandedCategories.includes(category.id);
                                    const isSelected = formData.assigned_categories.includes(category.id);
                                    const hasSubcategories = category.subcategories?.length > 0;

                                    return (
                                        <div key={category.id} style={{ marginBottom: '0.25rem' }}>
                                            <div className={`category-item ${isSelected ? 'selected' : ''}`}>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
                                                    className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                                                >
                                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                </button>

                                                <div
                                                    className="category-content"
                                                    onClick={() => handleCategoryToggle(category.id)}
                                                >
                                                    <Folder size={18} style={{ color: isSelected ? 'var(--primary-blue)' : 'var(--gray-400)' }} fill={isSelected ? "currentColor" : "none"} />
                                                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: isSelected ? 'var(--primary-blue-dark)' : 'var(--gray-700)' }}>
                                                        {category.name}
                                                    </span>
                                                </div>

                                                <div
                                                    className={`category-checkbox ${isSelected ? 'selected' : ''}`}
                                                    onClick={() => handleCategoryToggle(category.id)}
                                                >
                                                    {isSelected && <Check size={12} style={{ color: 'white' }} strokeWidth={3} />}
                                                </div>
                                            </div>

                                            {/* Subcategories */}
                                            {isExpanded && hasSubcategories && (
                                                <div className="subcategory-list">
                                                    {category.subcategories.map(sub => {
                                                        const isSubSelected = formData.assigned_subcategories.includes(sub.id);
                                                        return (
                                                            <div
                                                                key={sub.id}
                                                                className={`subcategory-item ${isSubSelected ? 'selected' : ''}`}
                                                                onClick={() => handleSubcategoryToggle(sub.id, category.id)}
                                                            >
                                                                <Target size={14} style={{ marginRight: '0.5rem', color: isSubSelected ? '#9333ea' : 'var(--gray-400)' }} />
                                                                <span style={{ fontSize: '0.875rem', flex: 1, fontWeight: isSubSelected ? '500' : '400', color: isSubSelected ? '#581c87' : 'var(--gray-600)' }}>
                                                                    {sub.name}
                                                                </span>
                                                                <div className={`subcategory-checkbox ${isSubSelected ? 'selected' : ''}`}>
                                                                    {isSubSelected && <Check size={10} style={{ color: 'white' }} strokeWidth={3} />}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Sticky at bottom */}
                <div className="employee-modal-footer">
                    <div className="footer-btn-container">
                        <button
                            onClick={currentStep === 1 && !editingUser ? onClose : handleBack}
                            className="btn-back"
                            disabled={isSubmitting}
                        >
                            <ArrowLeft size={16} />
                            {currentStep === 1 && !editingUser ? 'Cancel' : 'Back'}
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            {currentStep < totalSteps ? (
                                <button
                                    onClick={handleNext}
                                    disabled={!canProceedToNextStep()}
                                    className="btn-next"
                                >
                                    Next Step
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className="btn-submit"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div style={{ width: '1rem', height: '1rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Check size={18} strokeWidth={2.5} />
                                            <span>{editingUser ? 'Update Employee' : 'Create Employee'}</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeModal;
