import axios from 'axios';
import api from '../config/api';

const VAPID_PUBLIC_KEY_URL = '/push/vapid-public-key';
const SUBSCRIBE_URL = '/push/subscribe';

// Check subscription status
export const getSubscriptionStatus = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return 'unsupported';
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            return 'granted';
        }

        return Notification.permission;
    } catch (error) {
        console.error('Error checking subscription status:', error);
        return 'error';
    }
};

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
            // Ensure sw.js is in public folder
            const registration = await navigator.serviceWorker.register('/sw.js');
            return registration;
        } catch (error) {
            console.error('Service Worker registration failed:', error);
            return null;
        }
    } else {
        console.warn('Push messaging is not supported');
        return null;
    }
};

export const subscribeUser = async (registration) => {
    try {
        // Use api instance to respect base URL
        const response = await api.get(VAPID_PUBLIC_KEY_URL);
        const publicKey = response.data.publicKey;
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        // Send subscription to backend
        await api.post(SUBSCRIBE_URL, subscription);
        console.log('User subscribed to push notifications');
        return true;

    } catch (error) {
        console.error('Failed to subscribe the user: ', error);
        return false;
    }
};
