import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, CheckCircle } from 'lucide-react';

const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_META = {
    present: {
        label: 'Present',
        badgeClass: 'bg-green-100 text-green-700 border border-green-200'
    },
    absent: {
        label: 'Absent',
        badgeClass: 'bg-red-100 text-red-700 border border-red-200'
    },
    not_marked: {
        label: 'Not marked',
        badgeClass: 'bg-gray-100 text-gray-700 border border-gray-200'
    }
};

const formatIsoDate = (isoDate, formatOptions = {}) => {
    if (!isoDate) return '';
    const date = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleDateString(undefined, formatOptions);
};

const parseMonthKey = (monthKey) => {
    if (!monthKey) return null;
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (Number.isNaN(year) || Number.isNaN(month)) return null;
    return { year, month };
};

const buildCalendarMatrix = (monthKey) => {
    const parts = parseMonthKey(monthKey);
    if (!parts) return [];

    const { year, month } = parts;
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startWeekday = firstDay.getUTCDay(); // 0 (Sun) - 6 (Sat)

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const cells = [];

    for (let index = 0; index < totalCells; index += 1) {
        const dayOffset = index - startWeekday + 1;
        const cellDate = new Date(Date.UTC(year, month - 1, dayOffset));
        const isCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
        const isoDate = `${cellDate.getUTCFullYear()}-${String(cellDate.getUTCMonth() + 1).padStart(2, '0')}-${String(
            cellDate.getUTCDate()
        ).padStart(2, '0')}`;
        cells.push({
            index,
            isCurrentMonth,
            isoDate,
            day: cellDate.getUTCDate(),
            weekday: cellDate.getUTCDay()
        });
    }

    return cells;
};

const CalendarWidget = ({
    monthKey,
    onMonthChange,
    calendarData,
}) => {
    const data = calendarData || {
        sundays: [],
        publicHolidays: [],
        customHolidays: [],
        attendanceStatus: {}
    };

    const calendarCells = useMemo(() => buildCalendarMatrix(monthKey), [monthKey]);

    const publicHolidayMap = useMemo(() => {
        const map = new Map();
        (data.publicHolidays || []).forEach((holiday) => {
            const normalizedDate = holiday.date ? holiday.date.split('T')[0] : holiday.date;
            if (normalizedDate) map.set(normalizedDate, holiday);
        });
        return map;
    }, [data.publicHolidays]);

    const customHolidayMap = useMemo(() => {
        const map = new Map();
        (data.customHolidays || []).forEach((holiday) => {
            const normalizedDate = holiday.date ? holiday.date.split('T')[0] : holiday.date;
            if (normalizedDate) map.set(normalizedDate, holiday);
        });
        return map;
    }, [data.customHolidays]);

    const attendanceStatusMap = useMemo(() => {
        // Determine the type of attendanceStatus
        // It might be an Object from backend: { "2023-01-01": "present" }
        // Or a Map depending on how it's passed.
        // Based on attendanceController.js logic, it's likely an Object.
        const entries = data.attendanceStatus && typeof data.attendanceStatus === 'object'
            ? data.attendanceStatus
            : {};
        return new Map(Object.entries(entries));
    }, [data.attendanceStatus]);

    const sundaySet = useMemo(() => new Set(data.sundays || []), [data.sundays]);

    const monthLabel = useMemo(() => {
        const parts = parseMonthKey(monthKey);
        if (!parts) return '';
        return `${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
    }, [monthKey]);

    const handlePrevMonth = () => {
        if (!monthKey || !onMonthChange) return;
        const parts = parseMonthKey(monthKey);
        if (!parts) return;
        const prev = new Date(Date.UTC(parts.year, parts.month - 2, 1));
        onMonthChange(`${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        if (!monthKey || !onMonthChange) return;
        const parts = parseMonthKey(monthKey);
        if (!parts) return;
        const next = new Date(Date.UTC(parts.year, parts.month, 1));
        onMonthChange(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`);
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <CalendarDays size={18} className="text-blue-600" />
                    <span className="font-semibold text-gray-900">{monthLabel}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200 hover:shadow-sm">
                        <ChevronLeft size={16} />
                    </button>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-white rounded-lg transition-colors text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200 hover:shadow-sm">
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="p-3">
                <div className="grid grid-cols-7 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    {WEEKDAY_NAMES.map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map((cell) => {
                        const status = attendanceStatusMap.get(cell.isoDate) || null;
                        const isSunday = sundaySet.has(cell.isoDate);
                        const publicHoliday = publicHolidayMap.get(cell.isoDate);
                        const customHoliday = customHolidayMap.get(cell.isoDate);
                        const isHoliday = Boolean(publicHoliday || customHoliday || isSunday);
                        const statusInfo = !isHoliday && status && STATUS_META[status];

                        let cellClass = "bg-white text-gray-700";
                        if (isHoliday) {
                            if (publicHoliday) cellClass = "bg-orange-50 text-orange-700 font-medium";
                            else if (customHoliday) cellClass = "bg-purple-50 text-purple-700 font-medium";
                            else if (isSunday) cellClass = "bg-amber-50 text-amber-700";
                        } else if (status === 'present') {
                            cellClass = "bg-green-50 text-green-700 font-bold border border-green-100";
                        } else if (status === 'absent') {
                            cellClass = "bg-red-50 text-red-700 font-bold border border-red-100";
                        } else if (cell.isCurrentMonth) {
                            cellClass = "bg-gray-50 text-gray-400";
                        }

                        if (!cell.isCurrentMonth) {
                            cellClass = "opacity-30";
                        }

                        return (
                            <div key={cell.index} className={`h-10 flex flex-col items-center justify-center rounded-lg text-sm transition-all ${cellClass}`} title={isHoliday ? (publicHoliday?.name || customHoliday?.title || 'Sunday') : (status || '')}>
                                <span>{cell.day}</span>
                                {/* Dot indicator for status if needed, but background color is better */}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="mt-auto p-3 border-t border-gray-100 bg-gray-50/30 text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div> Present</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> Absent</div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400"></div> Holiday</div>
            </div>
        </div>
    );
};

export default CalendarWidget;
