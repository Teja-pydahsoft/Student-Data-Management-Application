import React, { useState, useEffect } from 'react';
import { Loader2, Megaphone, Calendar } from 'lucide-react';
import api from '../../config/api';
import toast from 'react-hot-toast';

const StudentAnnouncements = () => {
    const [loading, setLoading] = useState(true);
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const response = await api.get('/announcements/student');
                if (response.data.success) {
                    setAnnouncements(response.data.data || []);
                }
            } catch (error) {
                console.error(error);
                toast.error('Failed to load announcements');
            } finally {
                setLoading(false);
            }
        };

        fetchAnnouncements();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold heading-font flex items-center gap-3">
                        <Megaphone className="text-blue-200" size={32} />
                        Campus Announcements
                    </h1>
                    <p className="text-blue-100 mt-2 max-w-2xl">
                        Stay updated with the latest news, events, and important circulars from the college administration.
                    </p>
                </div>
                <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            </div>

            {announcements.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
                        <Megaphone size={24} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No Announcements</h3>
                    <p className="text-gray-500">You're all caught up! Check back later for updates.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {announcements.map((ann) => (
                        <div key={ann.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                            {ann.image_url ? (
                                <div className="h-48 w-full bg-gray-100 overflow-hidden">
                                    <img
                                        src={ann.image_url}
                                        alt={ann.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>
                            ) : (
                                <div className="h-24 bg-gradient-to-r from-gray-50 to-gray-100 border-b flex items-center justify-center">
                                    <Megaphone className="text-gray-300" size={32} />
                                </div>
                            )}

                            <div className="p-6">
                                <div className="flex items-center gap-2 text-xs text-blue-600 font-medium mb-3">
                                    <span className="bg-blue-50 px-2 py-1 rounded-full">
                                        {ann.target_college || 'General'}
                                    </span>
                                    <span className="text-gray-400 flex items-center gap-1">
                                        <Calendar size={12} />
                                        {new Date(ann.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                                    {ann.title}
                                </h3>
                                <p className="text-gray-600 text-sm line-clamp-4 leading-relaxed">
                                    {ann.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentAnnouncements;
