self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();

        // Determine the target URL
        // Check top-level 'url' or nested 'data.url'
        const relativeUrl = data.url || (data.data && data.data.url) || '/';

        // Create absolute URL
        const urlToOpen = new URL(relativeUrl, self.location.origin).href;

        const options = {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: data.badge || '/icon-192x192.png',
            vibrate: [100, 50, 100],
            tag: 'attendance-update', // Group similar notifications
            renotify: true,
            actions: [], // Explicitly empty actions to discourage browser defaults
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '1',
                url: urlToOpen
            }
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Get URL from notification data
    const urlToOpen = event.notification.data.url || self.location.origin;

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (windowClients) {
            // Check if there is already a window open with this URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Check if the client matches the origin and is focused/focusable
                // We compare the origin and path roughly, or just focus the first available window and navigate
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not found, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
