import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
    Ticket,
    Clock,
    CheckCircle,
    Plus,
    ArrowRight,
    AlertCircle,
    Activity,
    Shield
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { SkeletonBox } from '../../components/SkeletonLoader';

const Dashboard = () => {
    const navigate = useNavigate();

    // Fetch tickets data for summary
    const { data: tickets = [], isLoading } = useQuery({
        queryKey: ['tickets'],
        queryFn: async () => {
            const response = await api.get('/tickets/student/my-tickets');
            return response.data?.data || [];
        }
    });

    const stats = {
        total: tickets.length,
        pending: tickets.filter(t => t.status === 'pending').length,
        resolved: tickets.filter(t => t.status === 'completed').length,
        active: tickets.filter(t => ['approaching', 'resolving'].includes(t.status)).length
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    if (isLoading) {
        return (
            <div className="space-y-8 animate-pulse">
                <div className="space-y-2">
                    <SkeletonBox height="h-10" width="w-64" />
                    <SkeletonBox height="h-4" width="w-48" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm h-40">
                            <SkeletonBox height="h-4" width="w-24" className="mb-4" />
                            <SkeletonBox height="h-10" width="w-full" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-8 pb-12"
        >
            {/* Welcome Header */}
            <motion.div variants={itemVariants} className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-gray-900 heading-font tracking-tight">
                    Support Dashboard
                </h1>
                <p className="text-gray-500 font-medium">
                    Manage and track your support requests and issues.
                </p>
            </motion.div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Tickets', value: stats.total, icon: Ticket, color: 'blue' },
                    { label: 'Pending', value: stats.pending, icon: Clock, color: 'yellow' },
                    { label: 'In Progress', value: stats.active, icon: Activity, color: 'purple' },
                    { label: 'Resolved', value: stats.resolved, icon: CheckCircle, color: 'green' }
                ].map((stat, idx) => (
                    <motion.div
                        key={idx}
                        variants={itemVariants}
                        className="bg-white rounded-xl p-6 lg:p-8 border border-gray-100 shadow-sm relative overflow-hidden group card-hover"
                    >
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className={`p-3 rounded-xl w-fit bg-${stat.color}-50 text-${stat.color}-600`}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <h3 className="text-[10px] lg:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{stat.label}</h3>
                                <p className="text-2xl lg:text-3xl font-bold text-gray-900">{stat.value}</p>
                            </div>
                        </div>
                        <div className={`absolute -bottom-4 -right-4 w-20 h-20 bg-${stat.color}-50 rounded-full mix-blend-multiply filter blur-xl opacity-70`}></div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Recent Activity */}
                <motion.div variants={itemVariants} className="lg:col-span-8 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-black text-gray-900 heading-font">Recent Tickets</h2>
                        <Link to="/student/my-tickets" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
                            View All <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>

                    {tickets.length > 0 ? (
                        <div className="space-y-4">
                            {tickets.slice(0, 3).map((ticket) => (
                                <div
                                    key={ticket.id}
                                    className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer"
                                    onClick={() => navigate('/student/my-tickets')}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <Ticket size={24} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 line-clamp-1">{ticket.title}</h4>
                                            <p className="text-xs text-gray-500 font-medium tracking-tight">#{ticket.ticket_number} • {new Date(ticket.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-center border shadow-sm ${ticket.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                        ['approaching', 'resolving'].includes(ticket.status) ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-yellow-50 text-yellow-700 border-yellow-100'
                                        }`}>
                                        {ticket.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-dashed border-gray-200 p-12 text-center">
                            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Shield className="text-blue-600" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">No active tickets</h3>
                            <p className="text-gray-500 mt-1 mb-6">Your support record is currently clean.</p>
                            <Link
                                to="/student/raise-ticket"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all hover:-translate-y-1 active:scale-95"
                            >
                                <Plus size={20} />
                                Raise First Ticket
                            </Link>
                        </div>
                    )}
                </motion.div>

                {/* Quick Actions */}
                <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
                    <h2 className="text-xl font-bold text-gray-900 heading-font">Quick Actions</h2>
                    <div className="grid grid-cols-1 gap-4">
                        <Link
                            to="/student/raise-ticket"
                            className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg shadow-blue-200 group relative overflow-hidden card-hover"
                        >
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <Plus size={80} />
                            </div>
                            <div className="relative z-10 flex flex-col gap-2">
                                <div className="p-3 bg-white/20 rounded-xl w-fit backdrop-blur-md mb-2">
                                    <Plus size={24} />
                                </div>
                                <h3 className="text-xl font-bold uppercase tracking-tight heading-font">Raise Ticket</h3>
                                <p className="text-blue-100 text-sm font-medium leading-relaxed opacity-90">Need help with something? Let us know immediately and we'll resolve it.</p>
                            </div>
                        </Link>

                        <div className="p-8 bg-white rounded-2xl text-gray-900 relative overflow-hidden group shadow-sm border border-gray-100 card-hover">
                            <div className="absolute -bottom-8 -right-8 p-4 opacity-5 group-hover:rotate-12 transition-transform">
                                <Activity size={120} />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-bold mb-2 uppercase tracking-tight heading-font">Support Desk</h3>
                                <p className="text-gray-500 text-sm mb-6 leading-relaxed">Our support team is available 24/7 for urgent academic and facility issues.</p>
                                <button
                                    onClick={() => navigate('/student/my-tickets')}
                                    className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-sm btn-hover"
                                >
                                    View FAQ
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
