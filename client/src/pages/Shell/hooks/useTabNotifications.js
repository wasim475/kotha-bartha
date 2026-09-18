import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useRealtime } from "../../../utility/helpers";

const baseTitle = "Kotha-Barta";
const faviconPath = "/logo.png";
const faviconSize = 64;
let faviconRenderId = 0;

const drawFavicon = (count) => {
  const renderId = ++faviconRenderId;
  const favicon = document.querySelector('link[rel="icon"]');
  if (!favicon) return;

  if (!count) {
    favicon.href = faviconPath;
    return;
  }

  const image = new Image();
  image.onload = () => {
    if (renderId !== faviconRenderId) return;

    const canvas = document.createElement("canvas");
    canvas.width = faviconSize;
    canvas.height = faviconSize;

    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, faviconSize, faviconSize);

    const label = count > 99 ? "99+" : String(count);
    const badgeRadius = label.length > 2 ? 23 : 20;

    context.fillStyle = "#dc2626";
    context.beginPath();
    context.arc(
      faviconSize - badgeRadius,
      badgeRadius,
      badgeRadius,
      0,
      Math.PI * 2,
    );
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = `700 ${label.length > 2 ? 18 : 22}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, faviconSize - badgeRadius, badgeRadius + 1);

    favicon.href = canvas.toDataURL("image/png");
  };
  image.src = faviconPath;
};

export default function useTabNotifications() {
  const location = useLocation();
  const countsRef = useRef({ messages: 0, notifications: 0 });

  const updateTab = () => {
    const { messages, notifications } = countsRef.current;
    const total = messages + notifications;

    document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
    drawFavicon(total);
  };

  const resetCounts = (type) => {
    countsRef.current[type] = 0;
    updateTab();
  };

  useRealtime("message:new", () => {
    if (!document.hidden && location.pathname.startsWith("/app/messages")) {
      resetCounts("messages");
      return;
    }

    countsRef.current.messages += 1;
    updateTab();
  });

  useRealtime("notification:new", () => {
    if (!document.hidden && location.pathname === "/app/notifications") {
      resetCounts("notifications");
      return;
    }

    countsRef.current.notifications += 1;
    updateTab();
  });

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) return;

      countsRef.current = { messages: 0, notifications: 0 };
      updateTab();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    updateTab();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.title = baseTitle;
      drawFavicon(0);
    };
  }, []);

  useEffect(() => {
    if (location.pathname.startsWith("/app/messages")) {
      countsRef.current.messages = 0;
    }

    if (location.pathname === "/app/notifications") {
      countsRef.current.notifications = 0;
    }

    const total = countsRef.current.messages + countsRef.current.notifications;
    document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
    drawFavicon(total);
  }, [location.pathname]);
}
