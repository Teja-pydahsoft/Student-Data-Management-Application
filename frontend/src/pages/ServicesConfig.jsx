import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Briefcase, Plus, Trash2, Edit2, Check, X, LayoutTemplate, AlertCircle, Building2 } from 'lucide-react';

const ServicesConfig = () => {
    const navigate = useNavigate();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Preview State
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

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

    const handleEdit = (service) => {
        navigate(`/services/edit/${service.id}`);
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

    // Table action preview handler
    const handleTablePreview = async (service) => {
        if (service.template_type === 'standard' && !service.template_config) {
            toast.error('Standard template has no preview');
            return;
        }
        const toastId = toast.loading('Generating preview...');
        try {
            const blob = await serviceService.previewTemplate({
                template_type: service.template_type || 'dynamic',
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
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Services Configuration</h1>
                    <p className="text-gray-500">Manage available services and their prices</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/college-configuration')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        <Building2 size={20} /> College Configuration
                    </button>
                    <button
                        onClick={() => navigate('/services/add')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={20} /> Add Service
                    </button>
                </div>
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
                            <tr><td colSpan="6" className="p-6 text-center">Loading...</td></tr>
                        ) : services.length === 0 ? (
                            <tr><td colSpan="6" className="p-6 text-center text-gray-500">No services found</td></tr>
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
                                            <button
                                                onClick={() => handleDelete(service.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete Service"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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
