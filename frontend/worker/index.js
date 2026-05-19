/**
 * Custom service worker extensions for Lectly.
 * This file is bundled INTO the main service worker by @ducanh2912/next-pwa.
 * It adds push notification handling alongside the auto-generated caching logic.
 */

// ── Push Notifications ──────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Lectly", body: event.data.text() };
  }

  const options = {
    body: data.body || "Your lecture is ready!",
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: data.tag || "lectly-notification",
    data: {
      url: data.url || "/dashboard",
    },
    vibrate: [100, 50, 100],
    actions: [{ action: "view", title: "View Notes" }],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Lectly", options)
  );
});

// When the student clicks the notification, open/focus Lectly
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If Lectly is already open, focus that tab and navigate
        for (const client of windowClients) {
          if (client.url.includes("lectly") && "focus" in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Otherwise open a new tab
        return self.clients.openWindow(url);
      })
  );
});
