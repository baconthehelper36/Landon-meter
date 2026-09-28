self.addEventListener("push", event => {
    if (!event.data) return;

    const data = event.data.json();

    event.waitUntil(
        self.registration.showNotification(
            data.title || "Landon's Dashboard",
            {
                body: data.body || "",
                icon: "/icon.png",
                badge: "/icon.png",
                tag: data.tag || "landon-notification",
                data: {
                    url: data.url || "/"
                }
            }
        )
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clientList => {

            for (const client of clientList) {
                if ("focus" in client) {
                    client.navigate(
                        event.notification.data.url
                    );
                    return client.focus();
                }
            }

            if (clients.openWindow) {
                return clients.openWindow(
                    event.notification.data.url
                );
            }
        })
    );
});
