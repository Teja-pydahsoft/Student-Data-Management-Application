import React, { useState, useEffect } from 'react';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    X,
    Trash2,
    CalendarCheck,
    Megaphone,
    MapPin,
    AlertCircle,

    User,
    Users,
    Pencil
} from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';
import TargetSelector from '../../components/TargetSelector';

const EventCalendar = ({ isEmbedded = false }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [calendarDays, setCalendarDays] = useState([]);

    // Form State
    const initialFormState = {
        title: '',
        description: '',
        event_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        event_type: 'academic',
        target_college: [],
        target_batch: [],
        target_course: [],
        target_branch: [],
        target_year: [],
        target_semester: []
    };
    const [formData, setFormData] = useState(initialFormState);
    const [editId, setEditId] = useState(null);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        generateCalendar(currentDate);
    }, [currentDate, events]);

    const fetchEvents = async () => {
        try {
            const response = await api.get('/events/admin');
            if (response.data.success) {
                setEvents(response.data.data);
            }
        } catch (error) {
            toast.error('Failed to load events');
        }
    };

    const generateCalendar = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDay = firstDay.getDay(); // 0 is Sunday

        const days = [];
        // Padding for previous month
        for (let i = 0; i < startingDay; i++) {
            days.push({ day: null });
        }
        // Actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dayEvents = events.filter(e => {
                const eventStartDate = new Date(e.event_date);
                // Reset time part for accurate comparison
                eventStartDate.setHours(0, 0, 0, 0);

                const eventEndDate = e.end_date ? new Date(e.end_date) : new Date(e.event_date);
                eventEndDate.setHours(0, 0, 0, 0);

                const currentDayDate = new Date(year, month, i);

                return currentDayDate >= eventStartDate && currentDayDate <= eventEndDate;
            });
            days.push({ day: i, date: dateStr, events: dayEvents });
        }
        setCalendarDays(days);
    };

    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const handleToday = () => setCurrentDate(new Date());

    const handleDayClick = (dayObj) => {
        if (!dayObj.day) return;
        setEditId(null);
        setFormData({ ...initialFormState, event_date: dayObj.date, end_date: dayObj.date });
        setSelectedDate(dayObj.date);
        setIsModalOpen(true);
    };

    const handleEditEvent = (event, e) => {
        e.stopPropagation();
        setEditId(event.id);

        const parseField = (val) => {
            if (!val) return [];
            return Array.isArray(val) ? val : (typeof val === 'string' ? JSON.parse(val) : []);
        };

        // Convert UTC date to IST date string for input
        const eventDate = new Date(event.event_date);
        const istDate = new Date(eventDate.getTime() + (5.5 * 60 * 60 * 1000));
        const formattedDate = istDate.toISOString().split('T')[0];

        let formattedEndDate = '';
        if (event.end_date) {
            const endDateObj = new Date(event.end_date);
            const istEndDate = new Date(endDateObj.getTime() + (5.5 * 60 * 60 * 1000));
            formattedEndDate = istEndDate.toISOString().split('T')[0];
        } else {
            formattedEndDate = formattedDate;
        }

        setFormData({
            title: event.title,
            description: event.description || '',
            event_date: formattedDate,
            end_date: formattedEndDate,
            start_time: event.start_time || '',
            end_time: event.end_time || '',
            event_type: event.event_type,
            target_college: parseField(event.target_college),
            target_batch: parseField(event.target_batch),
            target_course: parseField(event.target_course),
            target_branch: parseField(event.target_branch),
            target_year: parseField(event.target_year),
            target_semester: parseField(event.target_semester)
        });
        setIsModalOpen(true);
    };

    const handleDeleteEvent = async (id, e) => {
        e.stopPropagation();
        if (!window.confirm("Are you sure?")) return;
        try {
            await api.delete(`/events/${id}`);
            toast.success("Event deleted");
            fetchEvents();
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const payload = {
            ...formData,
            // Ensure arrays are sent properly (TargetSelector handles state, we just send it)
        };

        try {
            if (editId) {
                await api.put(`/events/${editId}`, payload);
                toast.success('Event updated');
            } else {
                await api.post('/events', payload);
                toast.success('Event created');
            }
            setIsModalOpen(false);
            fetchEvents();
        } catch (error) {
            console.error(error);
            toast.error('Failed to save event');
        } finally {
            setLoading(false);
        }
    };

    const getEventTypeColor = (type) => {
        switch (type) {
            case 'holiday': return 'bg-red-100 text-red-700 border-red-200';
            case 'exam': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'academic': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'event': return 'bg-purple-100 text-purple-700 border-purple-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <div className={`min-h-screen bg-gray-50/50 p-6 space-y-6 animate-fade-in ${isEmbedded ? '!min-h-0 !p-1' : ''}`}>
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 heading-font flex items-center gap-2">
                            <CalendarIcon className="text-blue-600" /> Event Calendar
                        </h1>
                        <p className="text-gray-500">Manage academic schedule and holidays.</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {isEmbedded && <div></div>} {/* Spacer if no header */}
                <div className="flex items-center gap-2 bg-white p-1 rounded-lg border shadow-sm ml-auto">
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
                <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-240px)]">
                    <div className="grid grid-cols-7 bg-gray-50 border-b shrink-0">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                            <div key={d} className="py-2 text-center text-sm font-semibold text-gray-500">{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-y-auto">
                        {calendarDays.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => handleDayClick(item)}
                                className={`min-h-[80px] p-1 border-b border-r relative group transition-colors ${!item.day ? 'bg-gray-50/50' : 'hover:bg-blue-50/30 cursor-pointer'} ${item.date === new Date().toISOString().split('T')[0] ? 'bg-blue-50/20' : ''}`}
                            >
                                {item.day && (
                                    <>
                                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${item.date === new Date().toISOString().split('T')[0] ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}`}>
                                            {item.day}
                                        </span>
                                        <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[calc(100%-24px)] custom-scrollbar">
                                            {item.events.map(ev => (
                                                <div
                                                    key={ev.id}
                                                    onClick={(e) => handleEditEvent(ev, e)}
                                                    className={`text-[10px] px-1 py-0.5 rounded border truncate hover:scale-105 transition-transform cursor-pointer flex justify-between items-center group-hover/event ${getEventTypeColor(ev.event_type)}`}
                                                >
                                                    <span className="truncate">{ev.title}</span>
                                                    <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="hidden group-hover/event:block text-red-600 hover:text-red-800"><X size={10} /></button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button className="p-0.5 hover:bg-blue-100 rounded text-blue-600"><Plus size={12} /></button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar: Upcoming & Legend */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <button
                            onClick={() => { setEditId(null); setFormData(initialFormState); setIsModalOpen(true); }}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold shadow hover:shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={18} /> Add Event
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Clock size={16} /> Upcoming Events</h3>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {events
                                .filter(e => new Date(e.event_date) >= new Date().setHours(0, 0, 0, 0))
                                .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
                                .slice(0, 10) // Limit to 10
                                .map(ev => (
                                    <div key={ev.id} className="p-3 rounded-lg border bg-gray-50 hover:bg-white hover:shadow-sm transition-all group/item">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{ev.title}</h4>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${getEventTypeColor(ev.event_type)}`}>{ev.event_type}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-2 mb-1">
                                            <CalendarCheck size={12} />
                                            {new Date(ev.event_date).toLocaleDateString()}
                                            {ev.end_date && ev.end_date !== ev.event_date && ` - ${new Date(ev.end_date).toLocaleDateString()}`}
                                        </div>
                                        <div className="flex justify-between items-center mt-2">
                                            {ev.target_college ? (
                                                <div className="text-[10px] text-gray-400 flex items-center gap-1">
                                                    <Users size={10} /> Targeted
                                                </div>
                                            ) : <span></span>}

                                            <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                <button onClick={(e) => handleEditEvent(ev, e)} className="p-1 hover:bg-blue-50 text-blue-600 rounded"><Pencil size={14} /></button>
                                                <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 size={14} /></button>
                                            </div>
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

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-xl font-bold">{editId ? 'Edit Event' : 'Create Event'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Event Title</label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full p-2 border rounded-lg"
                                                value={formData.title}
                                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                            <select
                                                className="w-full p-2 border rounded-lg"
                                                value={formData.event_type}
                                                onChange={e => setFormData({ ...formData, event_type: e.target.value })}
                                            >
                                                <option value="academic">Academic</option>
                                                <option value="event">Event</option>
                                                <option value="holiday">Holiday</option>
                                                <option value="exam">Exam</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                                                <input
                                                    required
                                                    type="date"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.event_date}
                                                    onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.end_date}
                                                    min={formData.event_date}
                                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Start Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.start_time}
                                                    onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">End Time (Optional)</label>
                                                <input
                                                    type="time"
                                                    className="w-full p-2 border rounded-lg"
                                                    value={formData.end_time}
                                                    onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                            <textarea
                                                className="w-full p-2 border rounded-lg h-32"
                                                value={formData.description}
                                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            ></textarea>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-4 rounded-xl border">
                                        <TargetSelector formData={formData} setFormData={setFormData} />
                                    </div>
                                </div>

                                <div className="flex justify-between pt-4 border-t">
                                    {editId && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteEvent(editId, e)}
                                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                                        >
                                            <Trash2 size={18} /> Delete Event
                                        </button>
                                    )}
                                    <div className="flex gap-3 ml-auto">
                                        <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                                        <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                                            {loading ? <Clock className="animate-spin" /> : (editId ? 'Update Event' : 'Create Event')}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EventCalendar;
