const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushNotificationService = {
  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        console.log("Service Worker registered with scope:", registration.scope);
        return registration;
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }
    return null;
  },

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  },

  async subscribeUser() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Send subscription to server
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: {
          "Content-Type": "application/json"
        }
      });

      localStorage.setItem("push_notifications_enabled", "true");
      return true;
    } catch (error) {
      console.error("Failed to subscribe user:", error);
      return false;
    }
  },

  async unsubscribeUser() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        
        // Notify server
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          body: JSON.stringify(subscription),
          headers: {
            "Content-Type": "application/json"
          }
        });
      }
      localStorage.setItem("push_notifications_enabled", "false");
      return true;
    } catch (error) {
      console.error("Failed to unsubscribe user:", error);
      return false;
    }
  },

  async sendNotification(title: string, message: string, url: string = "/") {
    try {
      await fetch("/api/notifications/send", {
        method: "POST",
        body: JSON.stringify({ title, message, url }),
        headers: {
          "Content-Type": "application/json"
        }
      });
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  },

  urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
};
