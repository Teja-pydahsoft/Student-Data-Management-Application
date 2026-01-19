
import React, { useState, useEffect } from 'react';
import {
    X,
    CheckCircle2,
    Clock,
    AlertCircle,
    Check,
    Calendar,
    Briefcase,
    TrendingUp,
    ListFilter
} from 'lucide-react';
import api from '../../config/api';
import { format } from 'date-fns';

const EmployeeHistoryModal = ({ isOpen, onClose, employee }) => {
    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState(null);

    useEffect(() => {
        if (isOpen && employee?.id) {
            fetchHistory();
        }
    }, [isOpen, employee]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/employees/${employee.id}/history`);
            if (response.data?.success) {
                setHistoryData(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch employee history:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const stats = historyData?.stats || {};
    const tickets = historyData?.history || [];

    const StatCard = ({ title, value, icon: Icon, color }) => {
        let colorClasses = {
            wrapper: 'from-white to-blue-50 border-blue-100',
            icon: 'bg-blue-50 text-blue-600',
            text: 'text-blue-600'
        };

        if (color?.includes('orange') || color?.includes('yellow')) {
            colorClasses = {
                wrapper: 'from-white to-orange-50 border-orange-100',
                icon: 'bg-orange-50 text-orange-600',
                text: 'text-orange-600'
            };
        } else if (color?.includes('green') || color?.includes('teal')) {
            colorClasses = {
                wrapper: 'from-white to-emerald-50 border-emerald-100',
                icon: 'bg-emerald-50 text-emerald-600',
                text: 'text-emerald-600'
            };
        } else if (color?.includes('red')) {
            colorClasses = {
                wrapper: 'from-white to-red-50 border-red-100',
                icon: 'bg-red-50 text-red-600',
                text: 'text-red-600'
            };
        }

        return (
            <div className={`flex flex-col p-5 rounded-2xl border bg-gradient-to-br shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 ${colorClasses.wrapper}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${colorClasses.icon}`}>
                    <Icon size={24} />
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{title}</h3>
                    <p className="text-2xl font-black text-gray-900">{value || 0}</p>
                </div>
            </div>
        );
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return 'bg-blue-50 text-blue-600 border-blue-100';
            case 'in_progress': return 'bg-orange-50 text-orange-600 border-orange-100';
            case 'resolved': return 'bg-green-50 text-green-600 border-green-100';
            case 'completed': return 'bg-teal-50 text-teal-600 border-teal-100';
            case 'closed': return 'bg-gray-50 text-gray-600 border-gray-100';
            default: return 'bg-gray-100 text-gray-500';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm">
            <div
                className="absolute inset-0 transition-opacity"
                onClick={onClose}
            />

            <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up overflow-hidden">
                {/* Header - Styled like Student Modal */}
                <div className="bg-gradient-to-r from-teal-600 to-blue-600 text-white p-4 sm:p-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                            <div className="bg-white/20 p-3.5 rounded-xl backdrop-blur-md shadow-inner">
                                <TrendingUp size={32} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{employee?.name}</h2>
                                <div className="flex items-center gap-3 mt-2 text-teal-50 font-medium">
                                    <span className="capitalize bg-white/20 px-3 py-1 rounded-lg text-sm border border-white/10 shadow-sm">
                                        {employee?.role}
                                    </span>
                                    <span className="opacity-60">•</span>
                                    <span className="text-base opacity-90">{employee?.email || employee?.username}</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 text-white/80 hover:bg-white/20 hover:text-white rounded-xl transition-all duration-200 hover:rotate-90"
                        >
                            <X size={28} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gray-50" style={{ backgroundColor: '#F9FAFB' }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full min-h-[400px]">
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600"></div>
                                <p className="text-gray-500 font-medium">Loading employee history...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Stats Section */}
                            <div className="border-b border-gray-200 pb-8">
                                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <div className="w-3 h-3 bg-blue-500 rounded-full ring-4 ring-blue-50"></div>
                                    Performance Overview
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                    <StatCard
                                        title="Total Assigned"
                                        value={stats.total_assigned}
                                        icon={Briefcase}
                                        color="text-blue-600"
                                    />
                                    <StatCard
                                        title="Completed"
                                        value={parseInt(stats.completed_tickets || 0) + parseInt(stats.closed_tickets || 0)}
                                        icon={CheckCircle2}
                                        color="text-green-600"
                                    />
                                    <StatCard
                                        title="In Progress"
                                        value={stats.in_progress_tickets}
                                        icon={Clock}
                                        color="text-orange-600"
                                    />
                                    <StatCard
                                        title="Critical Pending"
                                        value={stats.critical_pending}
                                        icon={AlertCircle}
                                        color="text-red-600"
                                    />
                                </div>
                            </div>

                            {/* Recent History Section */}
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                        <div className="w-3 h-3 bg-teal-500 rounded-full ring-4 ring-teal-50"></div>
                                        Interaction History
                                    </h3>
                                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                                        Last 50 interactions
                                    </span>
                                </div>

                                <div>
                                    {tickets.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {tickets.map((ticket) => (
                                                <div
                                                    key={ticket.id}
                                                    className="group bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 h-full flex flex-col"
                                                >
                                                    <div className="flex flex-col gap-3 flex-1">
                                                        {/* Header: ID & Status */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                                #{ticket.ticket_number}
                                                            </span>
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(ticket.status)}`}>
                                                                {ticket.status.replace('_', ' ')}
                                                            </span>
                                                        </div>

                                                        {/* Title & Category */}
                                                        <div className="flex-1">
                                                            <h4 className="font-bold text-gray-900 text-sm leading-snug group-hover:text-blue-600 transition-colors mb-2 line-clamp-2">
                                                                {ticket.title}
                                                            </h4>
                                                            {ticket.category_name && (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 rounded-md text-gray-600 text-[10px] font-medium border border-gray-100 mb-2">
                                                                    {ticket.category_name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Footer: Date */}
                                                        <div className="pt-3 mt-auto border-t border-gray-50 flex items-center text-xs text-gray-400 font-medium">
                                                            <Calendar size={12} className="mr-1.5" />
                                                            {format(new Date(ticket.assigned_at), 'MMM d, yyyy • h:mm a')}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-16 text-center flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm border border-gray-100">
                                                <ListFilter size={24} className="text-gray-400" />
                                            </div>
                                            <h4 className="text-base font-semibold text-gray-900 mb-0.5">No Activity Found</h4>
                                            <p className="text-sm text-gray-400">No recent tickets assigned to this employee.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeHistoryModal;
