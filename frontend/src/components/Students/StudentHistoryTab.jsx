import React, { useState, useEffect } from 'react';
import {
    MessageSquare,
    Plus,
    Loader2,
    User,
    Clock
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const StudentHistoryTab = ({ student }) => {
    const [remarks, setRemarks] = useState([]);
    const [loadingRemarks, setLoadingRemarks] = useState(false);
    const [newRemark, setNewRemark] = useState('');
    const [addingRemark, setAddingRemark] = useState(false);

    useEffect(() => {
        if (student?.admission_number) {
            fetchRemarks();
        }
    }, [student]);

    const fetchRemarks = async () => {
        setLoadingRemarks(true);
        try {
            const response = await api.get(`/student-history/remarks/${student.admission_number}`);
            if (response.data.success) {
                setRemarks(response.data.data);
            }
        } catch (error) {
            toast.error('Failed to load remarks');
        } finally {
            setLoadingRemarks(false);
        }
    };

    const handleAddRemark = async (e) => {
        e.preventDefault();
        if (!newRemark.trim()) return;

        setAddingRemark(true);
        try {
            const response = await api.post('/student-history/remarks', {
                admission_number: student.admission_number,
                remark: newRemark
            });

            if (response.data.success) {
                toast.success('Remark added');
                setNewRemark('');
                fetchRemarks();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add remark');
        } finally {
            setAddingRemark(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm text-sm">
                <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold">Batch</p>
                    <p className="font-medium text-gray-900">{student.batch || 'N/A'}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold">Current Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${student.student_status === 'Regular'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {student.student_status || 'Unknown'}
                    </span>
                </div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold">Year / Semester</p>
                    <p className="font-medium text-gray-900">{student.current_year} / {student.current_semester}</p>
                </div>
                <div>
                    <p className="text-gray-500 text-xs uppercase font-semibold">College</p>
                    <p className="font-medium text-gray-900 truncate" title={student.college}>{student.college}</p>
                </div>
            </div>

            {/* Remarks Section */}
            <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
                    <MessageSquare className="text-blue-600" size={20} /> Remarks History
                </h3>

                {loadingRemarks ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <RemarkSection title="Principal Remarks" category="Principal" remarks={remarks} icon="🎓" color="blue" />
                        <RemarkSection title="AO Remarks" category="AO" remarks={remarks} icon="📋" color="purple" />
                        <RemarkSection title="HOD Remarks" category="HOD" remarks={remarks} icon="👨‍🏫" color="amber" />
                        <RemarkSection title="Accountant Remarks" category="Accountant" remarks={remarks} icon="💰" color="green" />
                    </div>
                )}
            </div>

            {/* Add Remark */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Add New Remark</h4>
                <form onSubmit={handleAddRemark} className="flex flex-col sm:flex-row gap-4 items-start">
                    <textarea
                        value={newRemark}
                        onChange={(e) => setNewRemark(e.target.value)}
                        placeholder="Type remark here..."
                        className="flex-1 w-full min-h-[80px] p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                    />
                    <button
                        type="submit"
                        disabled={addingRemark || !newRemark.trim()}
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shrink-0"
                    >
                        {addingRemark ? <Loader2 className="animate-spin" size={18} /> : <><Plus size={18} /> Add</>}
                    </button>
                </form>
                <p className="text-xs text-gray-400 mt-2">
                    Remark will be logged under your current role automatically.
                </p>
            </div>
        </div>
    );
};

const RemarkSection = ({ title, category, remarks, icon, color }) => {
    const categoryRemarks = remarks.filter(r => r.remark_category === category);
    const colorClasses = {
        blue: 'bg-blue-50 border-blue-100 text-blue-800',
        purple: 'bg-purple-50 border-purple-100 text-purple-800',
        amber: 'bg-amber-50 border-amber-100 text-amber-800',
        green: 'bg-green-50 border-green-100 text-green-800'
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-72">
            <div className={`px-4 py-2.5 border-b font-bold flex items-center gap-2 text-sm ${colorClasses[color]}`}>
                <span>{icon}</span> {title}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {categoryRemarks.length > 0 ? (
                    categoryRemarks.map(remark => (
                        <div key={remark.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm group">
                            <p className="text-gray-800 whitespace-pre-wrap">{remark.remark}</p>
                            <div className="mt-1.5 flex items-center justify-between text-xs text-gray-400">
                                <span className="font-medium text-gray-500">{remark.created_by_name}</span>
                                <span className="flex items-center gap-1">
                                    <Clock size={10} />
                                    {new Date(remark.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                        No remarks recorded
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentHistoryTab;
