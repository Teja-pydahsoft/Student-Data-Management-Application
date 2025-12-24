import React from 'react';
import { Bell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationPermissionModal = ({ isOpen, onClose, onAllow }) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="p-6 text-center">
                        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-blue-600" />
                        </div>

                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Don't Miss Important Updates!
                        </h3>

                        <p className="text-gray-600 mb-6 leading-relaxed">
                            Turn on notifications to get instant updates about:
                            <br />
                            <span className="font-semibold text-gray-700">• Attendance Reports</span>
                            <br />
                            <span className="font-semibold text-gray-700">• Campus Events</span>
                            <br />
                            <span className="font-semibold text-gray-700">• Service Requests</span>
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={onAllow}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Turn On Notifications
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition-colors"
                            >
                                Maybe Later
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default NotificationPermissionModal;
