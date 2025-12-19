import React, { useEffect, useState } from 'react';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Briefcase, Plus, Trash2, Edit2, Check, X } from 'lucide-react';

const ServicesConfig = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        is_active: true,
        template_type: 'standard'
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
            setFormData({ name: '', description: '', price: '', is_active: true, template_type: 'standard' });
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
            template_type: service.template_type || 'standard'
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

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Services Configuration</h1>
                    <p className="text-gray-500">Manage available services and their prices</p>
                </div>
                <button
                    onClick={() => {
                        setEditingService(null);
                        setFormData({ name: '', description: '', price: '', is_active: true, template_type: 'standard' });
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
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleEdit(service)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {/* <button 
                                                onClick={() => handleDelete(service.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 size={16} />
                                            </button> */}
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
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl animate-scale-in">
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
                                <select
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.template_type}
                                    onChange={e => setFormData({ ...formData, template_type: e.target.value })}
                                >
                                    <option value="standard">Standard (None)</option>
                                    <option value="study_certificate">Study Certificate</option>
                                    <option value="bonafide_certificate">Bonafide Certificate</option>
                                    <option value="bus_pass">Bus Pass Certificate</option>
                                </select>
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
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                                >
                                    {editingService ? 'Update Service' : 'Create Service'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServicesConfig;
