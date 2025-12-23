import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Clock,
    CalendarCheck,
    MapPin,
    AlertCircle
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const StudentCalendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [calendarDays, setCalendarDays] = useState([]);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        generateCalendar(currentDate);
    }, [currentDate, events]);

    const fetchEvents = async () => {
        try {
            const response = await api.get('/events/student');
            if (response.data.success) {
                setEvents(response.data.data);
            }
        } catch (error) {
            console.error(error);
            // toast.error('Failed to load events'); // Optional: suppress if minor
        }
    };

    const generateCalendar = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay();

        const days = [];
        for (let i = 0; i < startingDay; i++) {
            days.push({ day: null });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEvents = events.filter(e => {
                const eventDate = new Date(e.event_date);
                return eventDate.getDate() === i &&
                    eventDate.getMonth() === month &&
                    eventDate.getFullYear() === year;
            });
            days.push({ day: i, date: dateStr, events: dayEvents });
        }
        setCalendarDays(days);
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const getEventTypeColor = (type) => {
        switch (type) {
            case 'holiday': return 'bg-red-100 text-red-700 border-red-200';
            case 'exam': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'academic': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className="min-h-screen bg-transparent p-6 space-y-6 animate-fade-in text-gray-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 heading-font flex items-center gap-2">
                        <CalendarIcon className="text-blue-600" /> Academic Calendar
                    </h1>
                    <p className="text-gray-500">View upcoming holidays, exams, and events.</p>
                </div>
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-md"><ChevronLeft size={20} /></button>
                    <span className="font-bold w-32 text-center select-none">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-md"><ChevronRight size={20} /></button>
                    <button onClick={handleToday} className="ml-2 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md font-medium hover:bg-blue-100">Today</button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Calendar Grid */}
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50 border-b">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="py-3 text-center text-sm font-semibold text-gray-500">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-fr">
                        {calendarDays.map((item, idx) => (
                            <div
                                key={idx}
                                className={`min-h-[100px] p-2 border-b border-r relative transition-colors ${!item.day ? 'bg-gray-50/50' : 'hover:bg-blue-50/10'} ${item.date === new Date().toISOString().split('T')[0] ? 'bg-blue-50/20' : ''}`}
                            >
                                {item.day && (
                                    <>
                                        <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${item.date === new Date().toISOString().split('T')[0] ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                                            {item.day}
                                        </span>
                                        <div className="mt-2 space-y-1">
                                            {item.events.map(ev => (
                                                <div
                                                    key={ev.id}
                                                    title={ev.description || ev.title}
                                                    className={`text-[10px] px-1.5 py-1 rounded border truncate cursor-default ${getEventTypeColor(ev.event_type)}`}
                                                >
                                                    <span className="truncate font-medium">{ev.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar: Upcoming */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-fit">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={16} /> Upcoming</h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                        {events
                            .filter(e => new Date(e.event_date) >= new Date().setHours(0, 0, 0, 0))
                            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
                            .slice(0, 5) // Limit to 5
                            .map(ev => (
                                <div key={ev.id} className="p-3 rounded-lg border bg-gray-50 relative overflow-hidden">
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${ev.event_type === 'holiday' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                                    <div className="pl-2">
                                        <div className="flex justify-between items-start mb-1 gap-2">
                                            <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{ev.title}</h4>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2 mb-1">
                                            <CalendarCheck size={12} /> {new Date(ev.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                        </div>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider inline-block ${getEventTypeColor(ev.event_type)}`}>{ev.event_type}</span>
                                    </div>
                                </div>
                            ))}
                        {events.filter(e => new Date(e.event_date) >= new Date().setHours(0, 0, 0, 0)).length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-4">No upcoming events</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentCalendar;
