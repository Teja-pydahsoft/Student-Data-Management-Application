import React, { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react';

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
  submitted: {
    label: 'Submitted',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200'
  },
  not_marked: {
    label: 'Not marked',
    badgeClass: 'bg-rose-100 text-rose-700 border border-rose-200'
  },
  pending: {
    label: 'Pending',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200'
  },
  upcoming: {
    label: 'Upcoming',
    badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200'
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

const HolidayCalendarModal = ({
  isOpen,
  onClose,
  monthKey,
  onMonthChange,
  selectedDate,
  onSelectDate,
  calendarData,
  loading = false,
  error = null,
  onRetry,
  onCreateHoliday,
  onRemoveHoliday,
  mutationLoading = false,
  isAdmin = false
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');

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
      map.set(holiday.date, holiday);
    });
    return map;
  }, [data.publicHolidays]);

  const customHolidayMap = useMemo(() => {
    const map = new Map();
    (data.customHolidays || []).forEach((holiday) => {
      map.set(holiday.date, holiday);
    });
    return map;
  }, [data.customHolidays]);

  const attendanceStatusMap = useMemo(() => {
    const entries = data.attendanceStatus && typeof data.attendanceStatus === 'object'
      ? data.attendanceStatus
      : {};
    return new Map(Object.entries(entries));
  }, [data.attendanceStatus]);

  const sundaySet = useMemo(() => new Set(data.sundays || []), [data.sundays]);

  const selectedHolidayDetails = useMemo(() => {
    if (!selectedDate) return null;
    const publicHoliday = publicHolidayMap.get(selectedDate);
    const customHoliday = customHolidayMap.get(selectedDate);
    const isSunday = sundaySet.has(selectedDate);
    const status = attendanceStatusMap.get(selectedDate) || null;

    return {
      publicHoliday,
      customHoliday,
      isSunday,
      status
    };
  }, [selectedDate, publicHolidayMap, customHolidayMap, sundaySet, attendanceStatusMap]);

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

  const handleDayClick = (cell) => {
    if (!cell.isCurrentMonth) return;
    if (!onSelectDate) return;
    onSelectDate(cell.isoDate);

    const customHoliday = customHolidayMap.get(cell.isoDate);
    if (customHoliday) {
      setLocalTitle(customHoliday.title || '');
      setLocalDescription(customHoliday.description || '');
    } else {
      setLocalTitle('');
      setLocalDescription('');
    }
  };

  useEffect(() => {
    if (!selectedDate) {
      setLocalTitle('');
      setLocalDescription('');
      return;
    }

    const customHoliday = customHolidayMap.get(selectedDate);
    if (customHoliday) {
      setLocalTitle(customHoliday.title || '');
      setLocalDescription(customHoliday.description || '');
    } else {
      setLocalTitle('');
      setLocalDescription('');
    }
  }, [selectedDate, customHolidayMap]);

  const handleCreateHoliday = () => {
    if (!selectedDate || !onCreateHoliday) return;
    const payload = {
      date: selectedDate,
      title: localTitle || 'Holiday',
      description: localDescription
    };
    onCreateHoliday(payload);
  };

  const handleRemoveHoliday = () => {
    if (!selectedDate || !onRemoveHoliday) return;
    onRemoveHoliday(selectedDate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-blue-100 p-3 text-blue-600">
              <CalendarDays size={24} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Academic Calendar</h2>
              <p className="text-sm text-gray-500">
                Review public holidays, institute breaks, and mark custom holidays.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close calendar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 border-b border-gray-200 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-6 py-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100"
                aria-label="Previous month"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-900">{monthLabel}</div>
                <div className="text-xs text-gray-500">
                  {loading ? 'Loading calendar…' : 'Tap a date to view details'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100"
                aria-label="Next month"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 px-4 pb-3 text-center text-xs font-semibold uppercase text-gray-500">
              {WEEKDAY_NAMES.map((name) => (
                <div key={name} className="py-2">
                  {name}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 px-4 pb-6">
              {calendarCells.map((cell) => {
                const status = attendanceStatusMap.get(cell.isoDate) || null;
                const isSelected = selectedDate === cell.isoDate;
                const isSunday = sundaySet.has(cell.isoDate);
                const publicHoliday = publicHolidayMap.get(cell.isoDate);
                const customHoliday = customHolidayMap.get(cell.isoDate);
                const isHoliday = Boolean(publicHoliday || customHoliday || isSunday);
                const statusInfo = status && STATUS_META[status];

                const badgeColor = isHoliday
                  ? publicHoliday
                    ? 'bg-red-100 text-red-600 border border-red-200'
                    : customHoliday
                    ? 'bg-purple-100 text-purple-600 border border-purple-200'
                    : 'bg-amber-100 text-amber-600 border border-amber-200'
                  : 'bg-gray-50 text-gray-500 border border-gray-200';

                const baseClasses = cell.isCurrentMonth
                  ? 'cursor-pointer hover:border-blue-500 hover:text-blue-600'
                  : 'cursor-not-allowed text-gray-300';

                return (
                  <button
                    key={cell.index}
                    type="button"
                    onClick={() => handleDayClick(cell)}
                    disabled={!cell.isCurrentMonth}
                    className={`flex h-20 flex-col justify-between rounded-lg border py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                        : `bg-white text-gray-700 ${baseClasses}`
                    }`}
                  >
                    <span className="font-semibold">{cell.day}</span>
                    {isHoliday && (
                      <span className={`mx-2 rounded-md px-2 py-1 text-[10px] font-semibold ${badgeColor}`}>
                        {publicHoliday
                          ? 'Public Holiday'
                          : customHoliday
                          ? 'Institute Holiday'
                          : 'Sunday'}
                      </span>
                    )}
                    {!isHoliday && <span className="h-2" />}
                    {!isHoliday && statusInfo && (
                      <span
                        className={`mx-2 rounded-md px-2 py-1 text-[10px] font-semibold ${statusInfo.badgeClass}`}
                      >
                        {statusInfo.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold uppercase tracking-wide text-red-800">
                    Calendar data unavailable
                  </div>
                  <div>{error}</div>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-4 hover:text-red-800"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="w-full max-w-full px-6 py-5 lg:w-96">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Selected Date</h3>
              {selectedDate && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {formatIsoDate(selectedDate, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              )}
            </div>

            {!selectedDate && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Choose a date on the calendar to view holiday details or mark an institute break.
              </div>
            )}

            {selectedDate && (
              <div className="mt-4 space-y-4">
                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                  <div className="font-semibold text-blue-900">
                    {selectedHolidayDetails?.publicHoliday
                      ? selectedHolidayDetails.publicHoliday.localName ||
                        selectedHolidayDetails.publicHoliday.name
                      : selectedHolidayDetails?.customHoliday
                      ? selectedHolidayDetails.customHoliday.title || 'Institute Holiday'
                      : selectedHolidayDetails?.isSunday
                      ? 'Sunday'
                      : 'Instructional Day'}
                  </div>
                  <div className="mt-1 text-xs text-blue-600">
                    {selectedHolidayDetails?.publicHoliday
                      ? selectedHolidayDetails.publicHoliday.name
                      : selectedHolidayDetails?.customHoliday?.description
                      ? selectedHolidayDetails.customHoliday.description
                      : selectedHolidayDetails?.isSunday
                      ? 'Weekly holiday'
                      : 'Classes are expected to be held on this date.'}
                  </div>
                </div>
                {selectedHolidayDetails?.status && selectedHolidayDetails.status !== 'holiday' && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                      STATUS_META[selectedHolidayDetails.status]?.badgeClass ||
                      'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {STATUS_META[selectedHolidayDetails.status]?.label ||
                      selectedHolidayDetails.status}
                  </div>
                )}

                {isAdmin && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Holiday title
                      </label>
                      <input
                        type="text"
                        value={localTitle}
                        onChange={(event) => setLocalTitle(event.target.value)}
                        placeholder="e.g. Founders\' Day"
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={mutationLoading}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">
                        Notes (visible to staff)
                      </label>
                      <textarea
                        value={localDescription}
                        onChange={(event) => setLocalDescription(event.target.value)}
                        placeholder="Optional: add a note for this holiday"
                        rows={3}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        disabled={mutationLoading}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleCreateHoliday}
                        disabled={mutationLoading}
                        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
                      >
                        {mutationLoading ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Saving…
                          </>
                        ) : (
                          'Save Institute Holiday'
                        )}
                      </button>
                      {selectedHolidayDetails?.customHoliday && (
                        <button
                          type="button"
                          onClick={handleRemoveHoliday}
                          disabled={mutationLoading}
                          className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Remove Custom Holiday
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Legend
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 rounded-full border border-red-200 bg-red-100" />
                  Public holiday
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 rounded-full border border-purple-200 bg-purple-100" />
                  Institute holiday
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 rounded-full border border-amber-200 bg-amber-100" />
                  Sunday
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 rounded-full border border-emerald-200 bg-emerald-100" />
                  Attendance submitted
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-4 w-4 rounded-full border border-rose-200 bg-rose-100" />
                  Attendance not marked
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  This month&apos;s holidays
                </div>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-2 text-sm text-gray-600">
                  {data.publicHolidays?.length === 0 &&
                  data.customHolidays?.length === 0 &&
                  data.sundays?.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                      No holidays recorded for this month yet.
                    </div>
                  ) : (
                    <>
                      {(data.publicHolidays || []).map((holiday) => (
                        <div
                          key={`public-${holiday.date}`}
                          className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-2 text-red-700"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-red-800">
                              {formatIsoDate(holiday.date, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">
                              {holiday.localName || holiday.name}
                            </div>
                            {holiday.name && holiday.localName && holiday.localName !== holiday.name && (
                              <div className="text-xs text-red-600">{holiday.name}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(data.customHolidays || []).map((holiday) => (
                        <div
                          key={`custom-${holiday.date}`}
                          className="flex items-start gap-2 rounded-lg border border-purple-100 bg-purple-50 p-2 text-purple-700"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-purple-400" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-purple-800">
                              {formatIsoDate(holiday.date, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">{holiday.title || 'Institute Holiday'}</div>
                            {holiday.description && (
                              <div className="text-xs text-purple-600">{holiday.description}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(data.sundays || []).map((iso) => (
                        <div
                          key={`sunday-${iso}`}
                          className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-700"
                        >
                          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-400" />
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                              {formatIsoDate(iso, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm font-semibold">Sunday</div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default HolidayCalendarModal;

