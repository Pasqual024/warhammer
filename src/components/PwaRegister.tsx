"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });

      if ("caches" in window) {
        caches.keys().then((keys) => {
          for (const key of keys.filter((name) => name.startsWith("hidden-board-"))) {
            caches.delete(key);
          }
        });
      }

      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA registration should never block the game UI.
    });
  }, []);

  return null;
}
