import React, { useEffect, useState } from 'react';
import { serviceService } from '../services/serviceService';
import { toast } from 'react-hot-toast';
import { Clock, CheckCircle, AlertCircle, Calendar, Filter, MessageSquare, ArrowRight, Download, CreditCard, Printer, X } from 'lucide-react';
import api from '../config/api';

const ServiceRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');

    // Action State
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [actionType, setActionType] = useState(null); // 'ready', 'close'
    const [actionData, setActionData] = useState({ collect_date: '', admin_note: '' });
    const [previewUrl, setPreviewUrl] = useState(null);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await serviceService.getRequests({ status: filterStatus });
            setRequests(response.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, [filterStatus]);

    const handleUpdateStatus = async () => {
        try {
            if (actionType === 'ready') {
                if (!actionData.collect_date || !actionData.admin_note) {
                    toast.error('Please provide collect date and notification note');
                    return;
                }
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'ready_to_collect',
                    ...actionData
                });
                toast.success('Request marked as Ready to Collect');
            } else if (actionType === 'close') {
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'closed'
                });
                toast.success('Request Closed');
            } else if (actionType === 'processing') {
                await serviceService.updateRequestStatus(selectedRequest.id, {
                    status: 'processing'
                });
                toast.success('Request marked as Processing');
            }

            setSelectedRequest(null);
            setActionType(null);
            setActionData({ collect_date: '', admin_note: '' });
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error('Update failed');
        }
    };

    const openActionModal = (req, type) => {
        setSelectedRequest(req);
        setActionType(type);
        // Pre-fill text for convenience
        if (type === 'ready') {
            setActionData({
                collect_date: new Date().toISOString().split('T')[0],
                admin_note: `Your ${req.service_name} is ready. Please collect it from the admin office.`
            });
        }
    };

    const handlePayment = async (request) => {
        if (!window.confirm(`Mark payment of ₹${request.service_price} as received?`)) return;

        try {
            await serviceService.processPayment(request.id);
            toast.success('Payment marked as received');
            fetchRequests();
        } catch (error) {
            console.error(error);
            toast.error('Payment update failed');
        }
    };

    const handlePrint = async (request) => {
        try {
            const toastId = toast.loading('Generating preview...');
            const response = await api.get(`/services/requests/${request.id}/download`, {
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            setPreviewUrl(url); // Set preview URL to open modal

            toast.dismiss(toastId);
        } catch (error) {
            console.error(error);
            toast.error('Preview failed. Check if payment is cleared.');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            processing: 'bg-blue-100 text-blue-800',
            ready_to_collect: 'bg-purple-100 text-purple-800',
            closed: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800'
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${styles[status] || 'bg-gray-100'}`}>
                {status.replace(/_/g, ' ')}
            </span>
        );
    };

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Service Requests</h1>
                    <p className="text-gray-500">Manage student service requests</p>
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                    <Filter size={16} className="text-gray-400 ml-2" />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-transparent border-none text-sm font-medium focus:ring-0 text-gray-700 py-1"
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="ready_to_collect">Ready to Collect</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Request Info</th>
                                <th className="px-6 py-4">Student</th>
                                <th className="px-6 py-4">Mobile</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Dates</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center">Loading...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-gray-500">No requests found</td></tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{req.service_name}</span>
                                                <span className="text-xs text-gray-500">ID: #{req.id}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{req.student_name}</span>
                                                <span className="text-xs text-gray-500">{req.admission_number} | {req.course}-{req.branch}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            {req.student_mobile || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(req.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">
                                            <div>Req: {new Date(req.request_date).toLocaleDateString()}</div>
                                            {req.collect_date && (
                                                <div className="text-purple-600 font-medium">Col: {new Date(req.collect_date).toLocaleDateString()}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {req.payment_status === 'pending' && (
                                                    <button
                                                        onClick={() => handlePayment(req)}
                                                        className="px-3 py-1.5 bg-green-50 text-green-700 text-xs font-semibold rounded hover:bg-green-100 flex items-center gap-1"
                                                    >
                                                        <CreditCard size={12} /> Mark Paid
                                                    </button>
                                                )}
                                                {req.payment_status === 'paid' && (
                                                    <button
                                                        onClick={() => handlePrint(req)}
                                                        className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded hover:bg-gray-200 flex items-center gap-1"
                                                    >
                                                        <Printer size={12} /> Print
                                                    </button>
                                                )}
                                                {req.status === 'pending' && (
                                                    <button
                                                        onClick={() => { setSelectedRequest(req); setActionType('processing'); handleUpdateStatus(); }}
                                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded hover:bg-blue-100"
                                                    >
                                                        Process
                                                    </button>
                                                )}
                                                {(req.status === 'pending' || req.status === 'processing') && (
                                                    <button
                                                        onClick={() => openActionModal(req, 'ready')}
                                                        className="px-3 py-1.5 bg-purple-50 text-purple-600 text-xs font-semibold rounded hover:bg-purple-100 flex items-center gap-1"
                                                    >
                                                        Mark Ready
                                                    </button>
                                                )}
                                                {req.status === 'ready_to_collect' && (
                                                    <button
                                                        onClick={() => { setSelectedRequest(req); setActionType('close'); }}
                                                        className="px-3 py-1.5 bg-green-50 text-green-600 text-xs font-semibold rounded hover:bg-green-100 flex items-center gap-1"
                                                    >
                                                        Close
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Action Modal */}
            {selectedRequest && actionType === 'ready' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-scale-in max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4">Mark as Ready to Collect</h2>
                        <div className="space-y-4">
                            {/* Dynamic Admin Fields */}
                            {selectedRequest?.admin_fields && selectedRequest.admin_fields.length > 0 && (
                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-2">
                                    <h3 className="text-sm font-bold text-blue-800 mb-2">Required Information</h3>
                                    <div className="space-y-3">
                                        {(typeof selectedRequest.admin_fields === 'string'
                                            ? JSON.parse(selectedRequest.admin_fields)
                                            : selectedRequest.admin_fields
                                        ).map((field, idx) => (
                                            <div key={idx}>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    {field.label}
                                                </label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={actionData[field.name] || ''}
                                                        onChange={e => setActionData({ ...actionData, [field.name]: e.target.value })}
                                                    >
                                                        <option value="">Select...</option>
                                                        {(field.options || []).map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                        className="w-full px-3 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                        value={actionData[field.name] || ''}
                                                        onChange={e => setActionData({ ...actionData, [field.name]: e.target.value })}
                                                        placeholder={`Enter ${field.label}`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Collect Date</label>
                                <input
                                    type="date"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={actionData.collect_date}
                                    onChange={e => setActionData({ ...actionData, collect_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notification to Student</label>
                                <textarea
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows="3"
                                    value={actionData.admin_note}
                                    onChange={e => setActionData({ ...actionData, admin_note: e.target.value })}
                                    placeholder="Enter message for student..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setSelectedRequest(null)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-medium text-gray-700">Cancel</button>
                                <button onClick={handleUpdateStatus} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-medium">Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Close Confirmation Modal */}
            {selectedRequest && actionType === 'close' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl animate-scale-in text-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                            <CheckCircle size={24} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Close Request?</h2>
                        <p className="text-gray-500 mb-6">This will mark the service as completed and closed.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedRequest(null)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-medium text-gray-700">Cancel</button>
                            <button onClick={handleUpdateStatus} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium">Yes, Close it</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Print Preview Modal */}
            {previewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <Printer className="text-blue-600" /> Certificate Preview
                            </h2>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        const iframe = document.getElementById('pdf-preview-frame');
                                        if (iframe) iframe.contentWindow.print();
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    <Printer size={18} /> Print Certificate
                                </button>
                                <button
                                    onClick={() => setPreviewUrl(null)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition"
                                >
                                    <X size={24} className="text-gray-500" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-gray-100 p-4">
                            <iframe
                                id="pdf-preview-frame"
                                src={previewUrl}
                                className="w-full h-full rounded-lg shadow-inner bg-white"
                                title="Certificate Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ServiceRequests;
