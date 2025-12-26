import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar,
    Clock,
    BarChart2,
    CheckCircle,
    XCircle,
    AlertCircle,
    BarChart3,
    History,
    RefreshCw,
    Check,
    X,
    AlertTriangle,
    Download
} from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend
} from 'recharts';
import api from '../../config/api';
import { toast } from 'react-hot-toast';
import CalendarWidget from '../../components/Attendance/CalendarWidget';

const Attendance = () => {
    const [loading, setLoading] = useState(true);
    const [historyData, setHistoryData] = useState(null);
    const [calendarMonthKey, setCalendarMonthKey] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [calendarData, setCalendarData] = useState(null);
    const [calendarLoading, setCalendarLoading] = useState(false);

    useEffect(() => {
        fetchAttendanceHistory();
    }, []);

    useEffect(() => {
        fetchCalendarData(calendarMonthKey);
    }, [calendarMonthKey]);

    const fetchCalendarData = async (monthKey) => {
        try {
            setCalendarLoading(true);
            const response = await api.get('/calendar/non-working-days', {
                params: {
                    month: monthKey,
                    countryCode: 'IN'
                }
            });
            if (response.data.success) {
                setCalendarData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching calendar:', error);
        } finally {
            setCalendarLoading(false);
        }
    };

    const fetchAttendanceHistory = async () => {
        try {
            const response = await api.get('/attendance/student');
            if (response.data.success) {
                setHistoryData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
            toast.error('Failed to load attendance records');
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Combine Calendar Data with Student Attendance Status
    const mergedCalendarData = useMemo(() => {
        if (!calendarData) return null;
        if (!historyData?.semester?.series) return calendarData;

        // Create a map of attendance status from historyData
        const statusMap = {};
        historyData.semester.series.forEach(entry => {
            if (entry.date) {
                // Normalize date just in case
                const dateKey = entry.date.split('T')[0];
                statusMap[dateKey] = entry.status;
            }
        });

        return {
            ...calendarData,
            attendanceStatus: statusMap
        };
    }, [calendarData, historyData]);

    const stats = useMemo(() => {
        if (!historyData?.semester?.series) return null;

        // Calculate robust stats from series data
        // Filter series for valid days (exclude future if needed, but usually series ends at today or sem end)
        // Check if day is holiday

        let present = 0;
        let absent = 0;
        let holidays = 0;
        let unmarked = 0; // "Pending"
        let totalWorkingDays = 0;

        historyData.semester.series.forEach(entry => {
            if (entry.isHoliday) {
                holidays++;
            } else {
                totalWorkingDays++; // It's a working day
                if (entry.status === 'present') present++;
                else if (entry.status === 'absent') absent++;
                else unmarked++; // Unmarked/Pending on a working day
            }
        });

        // If backend provided totals are suspiciously zero (like in the screenshot), trust our calculation
        // But backend might have nuanced logic for 'unmarked'.
        // Let's rely on our calculated 'totalWorkingDays'.

        const percentage = totalWorkingDays > 0 ? ((present / totalWorkingDays) * 100).toFixed(1) : '0.0';

        return {
            present,
            absent,
            holidays,
            unmarked,
            totalWorkingDays,
            percentage
        };

    }, [historyData]);


    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!historyData) {
        return (
            <div className="text-center py-12">
                <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No Attendance Records Found</h3>
                <p className="text-gray-500">Could not retrieve attendance data at this time.</p>
            </div>
        );
    }

    // Prepare chart data (ensure arrays based on admin modal logic)
    // Helper to transform series data for BarChart (convert status to numeric 1/0 and avoid object collision)
    const transformSeriesForChart = (series) => {
        return series.map(entry => ({
            ...entry,
            // Use different keys for the chart values or overwrite safely if we don't need the object in the chart tooltip directly
            // We overwrite 'holiday' knowing it was an object, but for the chart we need a number.
            // If we needed the object for a custom tooltip, we should have stored it in a different key (e.g. holidayDetails)
            present: entry.status === 'present' ? 1 : 0,
            absent: entry.status === 'absent' ? 1 : 0,
            holiday: entry.status === 'holiday' ? 1 : 0,
            unmarked: (entry.status === 'unmarked' || !entry.status) ? 1 : 0,
            originalHoliday: entry.holiday // Preserve the object if needed later (though default tooltip won't use this)
        }));
    };

    // Prepare chart data (ensure arrays based on admin modal logic)
    const activeSemesterSeries = transformSeriesForChart(historyData.semester?.series || []);
    const activeMonthlySeries = transformSeriesForChart(historyData.monthly?.series || []);
    const activeWeeklySeries = transformSeriesForChart(historyData.weekly?.series || []);

    // Monthly breakdown data preparation
    const monthlyBreakdown = (() => {
        if (!historyData.semester?.series) return [];

        const monthlyData = {};
        historyData.semester.series.forEach((entry) => {
            const date = new Date(entry.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = {
                    monthName,
                    present: 0,
                    absent: 0,
                    unmarked: 0,
                    holidays: 0,
                    total: 0
                };
            }

            if (entry.isHoliday) {
                monthlyData[monthKey].holidays++;
            } else if (entry.status === 'present') {
                monthlyData[monthKey].present++;
            } else if (entry.status === 'absent') {
                monthlyData[monthKey].absent++;
            } else {
                monthlyData[monthKey].unmarked++;
            }
            monthlyData[monthKey].total++;
        });

        return Object.keys(monthlyData).sort().map(key => ({
            key,
            ...monthlyData[key]
        }));
    })();

    return (
        <div className="space-y-6 animate-fade-in w-full max-w-[1920px] mx-auto px-4 md:px-6 pb-8">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-gray-900 heading-font">Attendance History</h1>
                    <p className="text-xs md:text-sm text-gray-500">Track your comprehensive attendance overview</p>
                </div>
            </header>

            {/* Semester Summary Card */}
            {historyData.semester && stats && (
                <section>
                    <div className="bg-white border border-indigo-100 rounded-2xl shadow-sm p-4 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                            <div className="space-y-1">
                                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Semester Attendance</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {historyData.semester?.startDate} → {historyData.semester?.endDate}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                        <Calendar size={14} /> {stats.totalWorkingDays} working days (Excl. Holidays)
                                    </span>
                                    {historyData.semester?.lastUpdated && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                                            <Clock size={14} /> Updated {historyData.semester?.lastUpdated}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-4 md:mt-0 w-full md:w-auto md:text-right">
                                <div className="flex md:inline-flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-indigo-50 border border-indigo-100 w-full md:w-auto">
                                    <div className="text-left">
                                        <p className="text-xs text-gray-600 font-medium uppercase">Attendance %</p>
                                        <p className="text-3xl font-bold text-indigo-700">{stats.percentage}%</p>
                                    </div>
                                    <div className="text-xs text-gray-500 space-y-1 text-right">
                                        <p>
                                            <span className="font-bold text-green-600">{stats.present}</span> present
                                        </p>
                                        <p>
                                            <span className="font-bold text-red-500">{stats.absent}</span> absent
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                <p className="text-xs text-gray-600 uppercase font-medium">Present</p>
                                <p className="text-2xl font-bold text-green-700">{stats.present}</p>
                            </div>
                            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                                <p className="text-xs text-gray-600 uppercase font-medium">Absent</p>
                                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                            </div>
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                <p className="text-xs text-gray-600 uppercase font-medium">Pending</p>
                                <p className="text-2xl font-bold text-gray-700">{stats.unmarked}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                                <p className="text-xs text-gray-600 uppercase font-medium">Holidays</p>
                                <p className="text-2xl font-bold text-amber-700">{stats.holidays}</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Main Content Grid: Charts Left, Calendar Right */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Charts & Timelines */}
                <div className="lg:col-span-8 space-y-6">
                    {/* Weekly & Monthly Summaries */}
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 md:p-6">
                            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wide">Weekly Summary</h3>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div>
                                    <p className="text-xs text-gray-500">Present</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {historyData.weekly?.totals?.present ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Absent</p>
                                    <p className="text-xl font-bold text-red-500">
                                        {historyData.weekly?.totals?.absent ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Pending</p>
                                    <p className="text-xl font-bold text-gray-600">
                                        {historyData.weekly?.totals?.unmarked ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Holiday</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {historyData.weekly?.totals?.holidays ?? 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 md:p-6">
                            <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide">Monthly Summary</h3>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                <div>
                                    <p className="text-xs text-gray-500">Present</p>
                                    <p className="text-xl font-bold text-green-600">
                                        {historyData.monthly?.totals?.present ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Absent</p>
                                    <p className="text-xl font-bold text-red-500">
                                        {historyData.monthly?.totals?.absent ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Pending</p>
                                    <p className="text-xl font-bold text-gray-600">
                                        {historyData.monthly?.totals?.unmarked ?? 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Holiday</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {historyData.monthly?.totals?.holidays ?? 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Charts */}
                    <section className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4">Monthly Status Timeline</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={activeMonthlySeries}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: '#f8fafc' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    <Bar dataKey="present" stackId="status" fill="#22c55e" name="Present" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="absent" stackId="status" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="holiday" stackId="status" fill="#f59e0b" name="Holiday" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="unmarked" stackId="status" fill="#a3a3a3" name="Pending" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </section>

                    {historyData.semester && (
                        <section className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-800 mb-4">Semester Status Timeline</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={activeSemesterSeries}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 9 }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Legend wrapperStyle={{ paddingTop: '5px' }} />
                                        <Bar dataKey="present" stackId="status" fill="#22c55e" name="Present" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="absent" stackId="status" fill="#ef4444" name="Absent" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="holiday" stackId="status" fill="#f59e0b" name="Holiday" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="unmarked" stackId="status" fill="#a3a3a3" name="Pending" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column: Calendar Widget */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="sticky top-6">
                        <CalendarWidget
                            monthKey={calendarMonthKey}
                            onMonthChange={setCalendarMonthKey}
                            calendarData={mergedCalendarData}
                        />
                        {/* Daily Breakdown (Recent activity below calendar) */}
                        <div className="mt-6">
                            <h3 className="text-sm font-bold text-gray-900 mb-3 px-1">Recent Activity</h3>
                            <div className="space-y-2">
                                {historyData.weekly?.series?.slice(0, 5).map((entry) => (
                                    <div
                                        key={entry.date}
                                        className={`flex items-center justify-between p-3 rounded-xl border ${entry.status === 'present'
                                            ? 'border-green-200 bg-green-50'
                                            : entry.status === 'absent'
                                                ? 'border-red-200 bg-red-50'
                                                : entry.status === 'holiday'
                                                    ? 'border-amber-200 bg-amber-50'
                                                    : 'border-gray-200 bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-8 rounded-full ${params(entry.status)}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-900">{entry.date}</p>
                                                <p className="text-xs capitalize text-gray-600">
                                                    {entry.status === 'holiday' ? 'Holiday' : entry.status || 'Pending'}
                                                </p>
                                            </div>
                                        </div>
                                        {getStatusIcon(entry.status)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Monthly Breakdown Grid */}
            {monthlyBreakdown.length > 0 && (
                <section>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">
                        Monthly Breakdown
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {monthlyBreakdown.map((month) => {
                            const totalWorkingDays = month.total - month.holidays;
                            const percentage = totalWorkingDays > 0
                                ? ((month.present / totalWorkingDays) * 100).toFixed(1)
                                : '0.0';

                            return (
                                <div
                                    key={month.key}
                                    className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all duration-200 hover:border-gray-300"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-base font-bold text-gray-800">{month.monthName}</h4>
                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${parseFloat(percentage) >= 75 ? 'bg-green-100 text-green-700' :
                                            parseFloat(percentage) >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {percentage}%
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-green-50 rounded-lg p-2.5">
                                            <p className="text-xs text-green-700 font-medium uppercase">Present</p>
                                            <p className="text-lg font-bold text-green-800">{month.present}</p>
                                        </div>
                                        <div className="bg-red-50 rounded-lg p-2.5">
                                            <p className="text-xs text-red-700 font-medium uppercase">Absent</p>
                                            <p className="text-lg font-bold text-red-800">{month.absent}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-2.5">
                                            <p className="text-xs text-gray-600 font-medium uppercase">Pending</p>
                                            <p className="text-lg font-bold text-gray-700">{month.unmarked}</p>
                                        </div>
                                        <div className="bg-amber-50 rounded-lg p-2.5">
                                            <p className="text-xs text-amber-700 font-medium uppercase">Holidays</p>
                                            <p className="text-lg font-bold text-amber-800">{month.holidays}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}
        </div>
    );
};

// Helper functions for the recent activity section
const params = (status) => {
    switch (status) {
        case 'present': return 'bg-green-500';
        case 'absent': return 'bg-red-500';
        case 'holiday': return 'bg-amber-500';
        default: return 'bg-gray-400';
    }
};

const getStatusIcon = (status) => {
    switch (status) {
        case 'present': return <CheckCircle size={18} className="text-green-600" />;
        case 'absent': return <XCircle size={18} className="text-red-500" />;
        case 'holiday': return <AlertCircle size={18} className="text-amber-600" />;
        default: return <Clock size={18} className="text-gray-400" />;
    }
};

export default Attendance;
