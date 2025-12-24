import React, { useEffect, useState } from 'react';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Briefcase, Plus, Trash2, Edit2, Check, X, LayoutTemplate, AlertCircle } from 'lucide-react';

const ServicesConfig = () => {
    // Preset configurations for different template types
    const ADMIN_FIELD_PRESETS = {
        'transfer_certificate': [
            { label: 'Conduct', name: 'conduct', type: 'text' },
            { label: 'Reason for Leaving', name: 'reason', type: 'select', options: ['Course Completed', 'Discontinued', 'Personal'] },
            { label: 'Date of Leaving', name: 'date_of_leaving', type: 'date' },
            { label: 'Promoted', name: 'promoted', type: 'select', options: ['Yes', 'No'] },
            { label: 'Mole 1', name: 'mole_1', type: 'text' },
            { label: 'Mole 2', name: 'mole_2', type: 'text' }
        ],
        'bonafide_certificate': [
            { label: 'Purpose', name: 'purpose', type: 'text' }
        ],
        'refund_application': [
            { label: 'Excess Amount', name: 'excess_amount', type: 'number' },
            { label: 'Amount in Words', name: 'amount_in_words', type: 'text' },
            { label: 'Cheque No', name: 'cheque_no', type: 'text' }
        ]
    };

    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        is_active: true,
        template_type: 'standard',
        admin_fields: []
    });

    const fetchServices = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getAllServices();
            setServices(response.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingService) {
                await serviceService.updateService(editingService.id, formData);
                toast.success('Service updated successfully');
            } else {
                await serviceService.createService(formData);
                toast.success('Service created successfully');
            }
            setShowModal(false);
            setEditingService(null);
            setFormData({ name: '', description: '', price: '', is_active: true, template_type: 'standard', admin_fields: [] });
            fetchServices();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Operation failed');
        }
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setFormData({
            name: service.name,
            description: service.description || '',
            price: service.price,
            is_active: !!service.is_active,
            template_type: service.template_type || 'standard',
            admin_fields: service.admin_fields ? (typeof service.admin_fields === 'string' ? JSON.parse(service.admin_fields) : service.admin_fields) : []
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;
        try {
            await serviceService.deleteService(id);
            toast.success('Service deleted');
            fetchServices();
        } catch (error) {
            toast.error('Failed to delete service');
        }
    };

    const toggleStatus = async (service) => {
        try {
            await serviceService.updateService(service.id, { ...service, is_active: !service.is_active });
            toast.success(`Service ${!service.is_active ? 'activated' : 'deactivated'}`);
            fetchServices();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    // Preview State
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    const handlePreview = async () => {
        try {
            if (formData.template_type === 'standard') {
                toast.error('Standard template has no preview');
                return;
            }

            const toastId = toast.loading('Generating preview...');
            const blob = await serviceService.previewTemplate({
                template_type: formData.template_type,
                service_name: formData.name
            });

            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            setPreviewUrl(url);
            setShowPreview(true);
            toast.dismiss(toastId);
        } catch (error) {
            console.error(error);
            toast.error('Preview failed');
        }
    };

    // Table action preview handler
    const handleTablePreview = async (service) => {
        if (service.template_type === 'standard') {
            toast.error('Standard template has no preview');
            return;
        }
        const toastId = toast.loading('Generating preview...');
        try {
            const blob = await serviceService.previewTemplate({
                template_type: service.template_type,
                service_name: service.name,
                template_config: service.template_config
            });
            const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
            setPreviewUrl(url);
            setShowPreview(true);
            toast.dismiss(toastId);
        } catch (e) {
            toast.dismiss(toastId);
            toast.error('Preview failed');
        }
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* Same JSX */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Services Configuration</h1>
                    <p className="text-gray-500">Manage available services and their prices</p>
                </div>
                <button
                    onClick={() => {
                        setEditingService(null);
                        setFormData({ name: '', description: '', price: '', is_active: true, template_type: 'standard', admin_fields: [] });
                        setShowModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus size={20} /> Add Service
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Service Name</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Price (₹)</th>
                            <th className="px-6 py-4">Admin Vars</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan="5" className="p-6 text-center">Loading...</td></tr>
                        ) : services.length === 0 ? (
                            <tr><td colSpan="5" className="p-6 text-center text-gray-500">No services found</td></tr>
                        ) : (
                            services.map((service) => (
                                <tr key={service.id} className="hover:bg-gray-50 group">
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => toggleStatus(service)}
                                            className={`px-2 py-1 rounded-full text-xs font-semibold ${service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                        >
                                            {service.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{service.name}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 truncate max-w-xs">{service.description || '-'}</td>
                                    <td className="px-6 py-4 font-mono text-gray-900">₹{service.price}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {(() => {
                                                let fields = [];
                                                try {
                                                    fields = typeof service.admin_fields === 'string'
                                                        ? JSON.parse(service.admin_fields)
                                                        : service.admin_fields || [];
                                                } catch (e) {
                                                    console.warn('Invalid admin_fields:', service.admin_fields);
                                                }

                                                return fields.length > 0 ? (
                                                    fields.map(f => (
                                                        <span key={f.name} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100">
                                                            {f.label}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(service)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleTablePreview(service)}
                                                className="p-1.5 text-gray-600 hover:bg-gray-50 rounded"
                                                title="Preview Template"
                                            >
                                                <div className="w-4 h-4 flex items-center justify-center">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </div>
                                            </button>
                                            {service.template_type !== 'standard' && (
                                                <a
                                                    href={`/services/design/${service.id}`}
                                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                                                    title="Design Certificate"
                                                >
                                                    <LayoutTemplate size={16} />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">{editingService ? 'Edit Service' : 'New Service'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.price}
                                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="3"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Template Type (Certificate Format)</label>
                                <div className="flex gap-2">
                                    <select
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.template_type}
                                        onChange={e => {
                                            const newType = e.target.value;
                                            // Auto-populate admin fields if empty and preset exists
                                            let newAdminFields = formData.admin_fields;
                                            if ((!newAdminFields || newAdminFields.length === 0) && ADMIN_FIELD_PRESETS[newType]) {
                                                newAdminFields = ADMIN_FIELD_PRESETS[newType];
                                                toast.success('Admin variables auto-filled based on template type');
                                            }
                                            setFormData({
                                                ...formData,
                                                template_type: newType,
                                                admin_fields: newAdminFields
                                            });
                                        }}
                                    >
                                        <option value="standard">Standard (None)</option>
                                        <option value="study_certificate">Study Certificate</option>
                                        <option value="refund_application">Refund Application</option>
                                        <option value="bonafide_certificate">Bonafide Certificate</option>
                                        <option value="transfer_certificate">Transfer Certificate (TC)</option>
                                        <option value="dynamic">Dynamic Certificate (Custom)</option>
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handlePreview}
                                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium whitespace-nowrap"
                                    >
                                        Preview
                                    </button>
                                </div>
                            </div>

                            {/* Admin Fields Configuration */}
                            <div className="border-t pt-4">
                                <h3 className="text-sm font-bold text-gray-900 mb-2">Admin Input Variables</h3>
                                <p className="text-xs text-gray-500 mb-3">Define variables that admin must fill when processing this request (e.g., Conduct, Reason).</p>

                                <div className="space-y-2 mb-3">
                                    {(formData.admin_fields || []).map((field, index) => (
                                        <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded">
                                            <input
                                                placeholder="Label (e.g. Conduct)"
                                                className="flex-1 px-2 py-1 text-sm border rounded outline-none"
                                                value={field.label}
                                                onChange={e => {
                                                    const newFields = [...formData.admin_fields];
                                                    newFields[index].label = e.target.value;
                                                    // Auto-generate name from label if name is empty
                                                    if (!newFields[index].name) {
                                                        newFields[index].name = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                                    }
                                                    setFormData({ ...formData, admin_fields: newFields });
                                                }}
                                            />
                                            <input
                                                placeholder="Var Name (e.g. conduct)"
                                                className="flex-1 px-2 py-1 text-sm border rounded outline-none bg-gray-100"
                                                value={field.name}
                                                onChange={e => {
                                                    const newFields = [...formData.admin_fields];
                                                    newFields[index].name = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                                    setFormData({ ...formData, admin_fields: newFields });
                                                }}
                                            />
                                            <select
                                                className="px-2 py-1 text-sm border rounded outline-none"
                                                value={field.type}
                                                onChange={e => {
                                                    const newFields = [...formData.admin_fields];
                                                    newFields[index].type = e.target.value;
                                                    setFormData({ ...formData, admin_fields: newFields });
                                                }}
                                            >
                                                <option value="text">Text</option>
                                                <option value="date">Date</option>
                                                <option value="number">Number</option>
                                                <option value="select">Select (Dropdown)</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newFields = formData.admin_fields.filter((_, i) => i !== index);
                                                    setFormData({ ...formData, admin_fields: newFields });
                                                }}
                                                className="text-red-500 hover:bg-red-50 p-1 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setFormData({
                                            ...formData,
                                            admin_fields: [...(formData.admin_fields || []), { label: '', name: '', type: 'text' }]
                                        })}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Add Variable
                                    </button>
                                </div>

                                {/* System Variables Reference */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <h4 className="text-xs font-bold text-blue-800 mb-2">Available System Variables (Auto-filled)</h4>

                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Student Details</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {['student_name', 'admission_number', 'pin_no', 'gender', 'dob', 'email', 'phone_number'].map(v => (
                                                    <code key={v} className="text-xs bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-600 cursor-help" title={`{${v}}`}>
                                                        {`{${v}}`}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">Academic</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {['course', 'branch', 'current_year', 'current_semester', 'academic_year'].map(v => (
                                                    <code key={v} className="text-xs bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-600 cursor-help" title={`{${v}}`}>
                                                        {`{${v}}`}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-blue-400 mb-1">College & Other</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {['college_name', 'college_address', 'date'].map(v => (
                                                    <code key={v} className="text-xs bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-600 cursor-help" title={`{${v}}`}>
                                                        {`{${v}}`}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-100 flex gap-2">
                                        <div className="text-yellow-600 pt-0.5"><AlertCircle size={14} /></div>
                                        <p className="text-[10px] text-yellow-800 leading-relaxed">
                                            <strong>Note:</strong> Any variable NOT listed above (e.g., <code>{`{reason}`}</code>, <code>{`{conduct}`}</code>) must be defined in the "Admin Input Variables" list above so that the admin is prompted to enter it when processing the request.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (Available to students)</label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                    title="Cancel"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                                    title="Save Service"
                                >
                                    {editingService ? 'Update Service' : 'Create Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] shadow-2xl animate-scale-in flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-bold">Template Preview</h2>
                            <button
                                onClick={() => {
                                    setShowPreview(false);
                                    if (previewUrl) window.URL.revokeObjectURL(previewUrl);
                                    setPreviewUrl(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 bg-gray-100 p-4">
                            {previewUrl ? (
                                <iframe
                                    src={previewUrl}
                                    className="w-full h-full rounded-lg shadow-sm border border-gray-200 bg-white"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">Loading preview...</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesConfig;
