import React, { useEffect, useState } from 'react';
import { serviceService } from '../../services/serviceService';
import { toast } from 'react-hot-toast';
import { Briefcase, Clock, CheckCircle, AlertCircle, Calendar, Plus } from 'lucide-react';

const Services = () => {
    const [services, setServices] = useState([]);
    const [myRequests, setMyRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [servicesData, requestsData] = await Promise.all([
                serviceService.getAllServices(),
                serviceService.getRequests() // Student's own requests
            ]);
            setServices(servicesData.data || []);
            setMyRequests(requestsData.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRequest = async (service) => {
        if (!window.confirm(`Are you sure you want to request ${service.name} for ₹${service.price}?`)) return;

        try {
            setRequesting(service.id);
            await serviceService.requestService(service.id);
            toast.success('Service requested successfully!');
            fetchData(); // Refresh lists
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Request failed');
        } finally {
            setRequesting(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'processing': return 'bg-blue-100 text-blue-800';
            case 'ready_to_collect': return 'bg-purple-100 text-purple-800 animate-pulse'; // Highlight ready
            case 'completed':
            case 'closed': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ready_to_collect': return <AlertCircle className="w-4 h-4" />;
            case 'closed': return <CheckCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    return (
        <div className="space-y-8 animate-fade-in p-6">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
                    <Briefcase size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Student Services</h1>
                    <p className="text-gray-500">Request certificates and other college services</p>
                </div>
            </div>

            {/* Available Services Grid */}
            <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Plus size={20} className="text-blue-500" /> Available Services
                </h2>

                {loading ? (
                    <div className="flex justify-center py-8">Loading...</div>
                ) : services.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed text-gray-500">
                        No services currently available.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service) => (
                            <div key={service.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Briefcase size={64} />
                                </div>

                                <h3 className="font-bold text-lg text-gray-900 mb-2">{service.name}</h3>
                                <p className="text-gray-500 text-sm mb-4 min-h-[40px]">{service.description || 'No description provided'}</p>

                                <div className="flex items-center justify-between mt-auto">
                                    <span className="text-xl font-bold text-slate-700">₹{service.price}</span>
                                    <button
                                        onClick={() => handleRequest(service)}
                                        disabled={requesting === service.id}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 shadow-sm"
                                    >
                                        {requesting === service.id ? 'Requesting...' : 'Request Service'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Request History */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">My Requests</h2>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-medium">Service</th>
                                <th className="px-6 py-4 font-medium">Request Date</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Admin Update</th>
                                <th className="px-6 py-4 font-medium">Collect Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {myRequests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        You haven't made any requests yet.
                                    </td>
                                </tr>
                            ) : (
                                myRequests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{req.service_name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {new Date(req.request_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(req.status)}`}>
                                                {getStatusIcon(req.status)}
                                                {req.status.replace(/_/g, ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={req.admin_note}>
                                            {req.admin_note || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                            {req.collect_date ? (
                                                <div className="flex items-center gap-2 text-purple-700">
                                                    <Calendar size={14} />
                                                    {new Date(req.collect_date).toLocaleDateString()}
                                                </div>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

export default Services;
