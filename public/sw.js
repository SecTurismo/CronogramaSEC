self.addEventListener("push", (event) => {
  const data = event.data.json();
  const title = data.title || "Nova Notificação";
  const options = {
    body: data.message || "Você tem uma nova atualização no sistema.",
    icon: "/icon-192x192.png", // Make sure this exists or use a generic one
    badge: "/badge-72x72.png",
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
