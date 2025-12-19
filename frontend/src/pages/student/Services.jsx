import React, { useEffect, useState } from 'react';
import { serviceService } from '../../services/serviceService';
import { toast } from 'react-hot-toast';
import { FileText, Clock, CheckCircle, AlertCircle, Download, CreditCard, X, Plus } from 'lucide-react';
import api from '../../config/api';

const Services = () => {
    const [services, setServices] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('available'); // 'available' or 'history'

    // Modal state
    const [selectedService, setSelectedService] = useState(null);
    const [requestForm, setRequestForm] = useState({ purpose: '' });
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [servicesRes, requestsRes] = await Promise.all([
                serviceService.getAllServices(),
                serviceService.getRequests()
            ]);
            setServices(servicesRes.data || []);
            setRequests(requestsRes.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRequest = async (e) => {
        e.preventDefault();
        if (!selectedService) return;

        try {
            setSubmitting(true);
            await serviceService.requestService({
                service_id: selectedService.id,
                purpose: requestForm.purpose
            });
            toast.success('Request submitted successfully');
            setSelectedService(null);
            setRequestForm({ purpose: '' });
            setActiveTab('history');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Request failed');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayment = async (request) => {
        if (!window.confirm(`Proceed to pay ₹${request.service_price} for ${request.service_name}?`)) return;

        try {
            const toastId = toast.loading('Processing payment...');
            await serviceService.processPayment(request.id);
            toast.dismiss(toastId);
            toast.success('Payment successful!');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Payment failed');
        }
    };

    const handleDownload = async (request) => {
        try {
            const toastId = toast.loading('Generating certificate...');

            // Use authenticated fetch for blob
            const response = await api.get(`/services/requests/${request.id}/download`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Certificate_${request.admission_number || 'download'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);

            toast.dismiss(toastId);
            toast.success('Downloaded successfully');

        } catch (error) {
            console.error(error);
            toast.error('Download failed. Please try again.');
        }
    };

    const StatusBadge = ({ status, paymentStatus }) => {
        if (status === 'ready_to_collect') {
            return <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium"><CheckCircle size={12} /> Ready to Collect</span>;
        }
        if (status === 'completed' || status === 'closed') {
            return <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"><CheckCircle size={12} /> Completed</span>;
        }
        if (paymentStatus === 'pending') {
            return <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium"><AlertCircle size={12} /> Payment Pending</span>;
        }
        return <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium"><Clock size={12} /> {status.replace(/_/g, ' ')}</span>;
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Student Services</h1>
                    <p className="text-gray-500">Request certificates and track status</p>
                </div>

                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('available')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'available' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Available Services
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        My Requests
                    </button>
                </div>
            </div>

            {activeTab === 'available' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-100 rounded-xl animate-pulse"></div>)
                    ) : services.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                            No services available at the moment.
                        </div>
                    ) : (
                        services.map(service => (
                            <div key={service.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100 transition">
                                        <FileText size={24} />
                                    </div>
                                    <span className="font-mono font-semibold text-gray-900">₹{service.price}</span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 mb-2">{service.name}</h3>
                                <p className="text-gray-500 text-sm mb-6 line-clamp-2">{service.description}</p>
                                <button
                                    onClick={() => setSelectedService(service)}
                                    className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition font-medium flex items-center justify-center gap-2"
                                >
                                    Apply Now
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Request ID</th>
                                    <th className="px-6 py-4">Service</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Purpose</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr><td colSpan="6" className="p-6 text-center">Loading...</td></tr>
                                ) : requests.length === 0 ? (
                                    <tr><td colSpan="6" className="p-12 text-center text-gray-500">No requests found</td></tr>
                                ) : (
                                    requests.map(req => (
                                        <tr key={req.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-mono text-gray-600 text-sm">#{req.id}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{req.service_name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {new Date(req.request_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                                                {(() => {
                                                    try {
                                                        const data = typeof req.request_data === 'string' ? JSON.parse(req.request_data) : req.request_data;
                                                        return data?.purpose || '-';
                                                    } catch (e) { return '-'; }
                                                })()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={req.status} paymentStatus={req.payment_status} />
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {/* Actions handled by Admin now. Student just views status */}
                                                {req.payment_status === 'pending' ? (
                                                    <span className="text-xs text-orange-600 font-medium">Pay at Office</span>
                                                ) : req.status === 'ready_to_collect' ? (
                                                    <span className="text-xs text-purple-600 font-medium">Ready for Collection</span>
                                                ) : (
                                                    <span className="text-xs text-gray-400">Processing</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Request Modal */}
            {selectedService && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedService.name}</h2>
                                <p className="text-sm text-gray-500">Fee: ₹{selectedService.price}</p>
                            </div>
                            <button onClick={() => setSelectedService(null)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleRequest} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Certificate</label>
                                <textarea
                                    required
                                    placeholder="e.g. For Scholarship Application, Visa, etc."
                                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                                    value={requestForm.purpose}
                                    onChange={e => setRequestForm({ ...requestForm, purpose: e.target.value })}
                                />
                            </div>

                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                Note: Certificate generated will include your current academic details from the database. Please ensure your profile is up to date.
                            </p>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Confirm Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Services;
