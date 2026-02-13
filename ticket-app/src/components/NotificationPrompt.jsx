import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check } from 'lucide-react';
import { getSubscriptionStatus, subscribeUser, registerServiceWorker } from '../services/pushService';
import toast from 'react-hot-toast';

const NotificationPrompt = () => {
    const [show, setShow] = useState(false);
    const [permission, setPermission] = useState('default');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            // Register SW first if not already
            await registerServiceWorker();

            const status = await getSubscriptionStatus();
            setPermission(status);

            // Show prompt if permission is default (not granted or denied)
            // and we haven't dismissed it recently
            const isDismissed = localStorage.getItem('notification_prompt_dismissed');
            if (status === 'default' && !isDismissed) {
                // Delay showing it a bit so it doesn't pop up instantly on load
                const timer = setTimeout(() => setShow(true), 3000);
                return () => clearTimeout(timer);
            }
        };

        checkStatus();
    }, []);

    const handleAllow = async () => {
        setLoading(true);
        try {
            // Request permission specifically
            const result = await Notification.requestPermission();
            setPermission(result);

            if (result === 'granted') {
                const reg = await navigator.serviceWorker.ready;
                const subscribed = await subscribeUser(reg);
                if (subscribed) {
                    toast.success('Notifications enabled successfully!');
                } else {
                    toast.error('Failed to subscribe to push service.');
                }
            } else {
                toast.error('Notifications blocked. Please enable them in browser settings.');
            }
        } catch (error) {
            console.error('Notification permission error:', error);
            toast.error('An error occurred while enabling notifications.');
        } finally {
            setLoading(false);
            setShow(false);
        }
    };

    const handleDismiss = () => {
        setShow(false);
        // Remember dismissal for a session or longer
        localStorage.setItem('notification_prompt_dismissed', 'true');
    };

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.9 }}
                    className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden"
                >
                    <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-start gap-4">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Bell className="text-white h-6 w-6" />
                        </div>
                        <div className="flex-1 text-white">
                            <h3 className="font-bold text-lg">Enable Notifications?</h3>
                            <p className="text-blue-100 text-xs mt-1">
                                Get real-time updates on your ticket status and replies.
                            </p>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-blue-100 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-4 bg-white flex gap-3 justify-end">
                        <button
                            onClick={handleDismiss}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                            Not Now
                        </button>
                        <button
                            onClick={handleAllow}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-all hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Enabling...' : (
                                <>
                                    <Check size={16} />
                                    Allow Access
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationPrompt;
