import React, { useEffect, useState, useMemo } from 'react';
import { Clock, Calendar, ChevronLeft, ChevronRight, BookOpen, MapPin, AlertCircle, Info } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import api from '../../config/api';
import { toast } from 'react-hot-toast';

const StudentTimetable = () => {
    const { user } = useAuthStore();
    const [timetableData, setTimetableData] = useState([]);
    const [periodSlots, setPeriodSlots] = useState([]);
    const [loading, setLoading] = useState(true);

    const days = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                // Step 1: Get period slots for the student's college
                const slotsRes = await api.get('/period-slots', { params: { college_id: user.college_id } });
                if (slotsRes.data.success) {
                    setPeriodSlots(slotsRes.data.data);
                }

                // Step 2: Get timetable data for the student's branch, year, and semester
                const timetableRes = await api.get('/timetable', {
                    params: {
                        branch_id: user.branch_id,
                        year: user.current_year,
                        semester: user.current_semester || 1 // Fallback to 1 if not defined
                    }
                });
                if (timetableRes.data.success) {
                    setTimetableData(timetableRes.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch timetable:', error);
                toast.error('Failed to load timetable');
            } finally {
                setLoading(false);
            }
        };

        if (user?.college_id && user?.branch_id) {
            fetchData();
        }
    }, [user]);

    const getEntryForSlot = (day, slotId) => {
        return timetableData.find(item => item.day_of_week === day && item.period_slot_id === slotId);
    };

    const currentDay = useMemo(() => {
        const d = new Date().getDay();
        // getDay() returns 0 for Sunday, 1 for Monday...
        const dayMap = ['SUN', 'MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];
        return dayMap[d];
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p className="text-slate-500 font-medium">Loading your schedule...</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Header section with summary */}
            <div className="bg-white rounded-[2rem] border border-slate-200 p-8 mb-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Class Timetable</h1>
                        <p className="text-slate-500 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            {user.branch} — Year {user.current_year}, Semester {user.current_semester || 1}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-indigo-50 px-6 py-4 rounded-2xl border border-indigo-100/50">
                        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none mb-1">Current Day</p>
                            <p className="text-lg font-bold text-indigo-900 leading-none">
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Timetable Grid Container */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <div className="min-w-[1000px]">
                        {/* Grid Header */}
                        <div className="flex border-b border-slate-100 bg-slate-50/50">
                            <div className="w-24 flex-shrink-0 p-6 flex items-center justify-center border-r border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">DAY</span>
                            </div>
                            <div className="flex-1 flex">
                                {periodSlots.map((slot) => (
                                    <div key={slot.id} className="flex-1 min-w-[120px] p-6 text-center border-r border-slate-100 last:border-r-0">
                                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{slot.slot_name}</p>
                                        <p className="text-sm font-bold text-slate-800 flex items-center justify-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Grid Body */}
                        <div className="divide-y divide-slate-100">
                            {days.map((day) => (
                                <div key={day} className={`flex group transition-colors ${day === currentDay ? 'bg-indigo-50/30' : 'hover:bg-slate-50/50'}`}>
                                    {/* Day Label */}
                                    <div className={`w-24 flex-shrink-0 p-6 flex items-center justify-center border-r border-slate-100 font-black text-sm tracking-tighter ${day === currentDay ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {day === currentDay && <div className="absolute left-0 w-1 h-12 bg-indigo-600 rounded-r-full" />}
                                        {day}
                                    </div>

                                    {/* Slots */}
                                    <div className="flex-1 flex">
                                        {(() => {
                                            let skipCount = 0;
                                            return periodSlots.map((slot) => {
                                                if (skipCount > 0) {
                                                    skipCount--;
                                                    return null;
                                                }

                                                const entry = getEntryForSlot(day, slot.id);
                                                const span = entry?.span || 1;
                                                if (span > 1) skipCount = span - 1;

                                                return (
                                                    <div
                                                        key={slot.id}
                                                        className={`flex flex-col p-3 border-r border-slate-100 last:border-r-0 min-h-[100px] transition-all`}
                                                        style={{ flex: span }}
                                                    >
                                                        {entry ? (
                                                            <div className={`h-full rounded-2xl p-4 flex flex-col justify-between border shadow-sm transition-transform hover:scale-[1.02] cursor-default ${entry.type === 'subject' ? 'bg-white border-slate-200' :
                                                                    entry.type === 'lab' ? 'bg-purple-50 border-purple-100' :
                                                                        'bg-amber-50 border-amber-100'
                                                                }`}>
                                                                <div>
                                                                    <div className="flex items-start justify-between mb-1">
                                                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${entry.type === 'subject' ? 'bg-indigo-100 text-indigo-700' :
                                                                                entry.type === 'lab' ? 'bg-purple-100 text-purple-700' :
                                                                                    'bg-amber-100 text-amber-700'
                                                                            }`}>
                                                                            {entry.type}
                                                                        </span>
                                                                        {span > 1 && (
                                                                            <span className="text-[10px] font-bold text-slate-400">
                                                                                {span} periods
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h4 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
                                                                        {entry.type === 'subject' ? entry.subject_name : entry.custom_label}
                                                                    </h4>
                                                                </div>

                                                                {entry.type === 'subject' && entry.subject_code && (
                                                                    <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                                                        <Info className="w-3.5 h-3.5" />
                                                                        {entry.subject_code}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="h-full rounded-2xl border border-dashed border-slate-100 flex items-center justify-center group-hover:border-slate-200 transition-colors">
                                                                <span className="text-[10px] font-bold text-slate-200 group-hover:text-slate-300 uppercase tracking-widest">Free Slot</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Info Tips */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex gap-3">
                    <Info className="w-5 h-5 text-blue-500 shrink-0" />
                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                        <strong>Note:</strong> Lab sessions typically span multiple periods. If you see a merged card, it means the class continues through those slots.
                    </p>
                </div>
                <div className="flex-1 bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                        <strong>Important:</strong> Changes to the timetable are managed by your Branch HOD. Please contact them for any clarification regarding the schedule.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StudentTimetable;
