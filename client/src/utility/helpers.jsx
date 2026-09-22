import { ErrorOutlined } from "@mui/icons-material";
import { useEffect, useState } from "react";
import Spinner from "../components/ui/Spinner";
export const realtime = new EventTarget();
export let activeSocket;
export const setActiveSocket = (socket) => {
  activeSocket = socket;
};
export const sendSignal = (to, signal) =>
  activeSocket?.emit("call:signal", { to, signal });
export const sendTypingSignal = (to, conversationId, typing) =>
  activeSocket?.emit(typing ? "typing:start" : "typing:stop", {
    to,
    conversationId,
  });

export function useRealtime(eventName, handler) {
  useEffect(() => {
    realtime.addEventListener(eventName, handler);
    return () => realtime.removeEventListener(eventName, handler);
  }, [eventName, handler]);
}

const colorNames = ["blue", "gold", "mint", "coral"];
export const colorFor = (id = "") =>
  colorNames[Number.parseInt(String(id).slice(-2), 16) % colorNames.length] ||
  "blue";

export const formatTime = (date) => {
  if (!date) return "";

  const diffMs = Date.now() - new Date(date).getTime();

  const diffMinutes = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);
  const diffWeeks = Math.round(diffMs / 604800000);
  const diffMonths = Math.round(diffMs / 2592000000);
  const diffYears = Math.round(diffMs / 31536000000);

  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  if (diffMinutes < 60) {
    return formatter.format(-diffMinutes, "minute");
  }

  if (diffHours < 24) {
    return formatter.format(-diffHours, "hour");
  }

  if (diffDays < 7) {
    return formatter.format(-diffDays, "day");
  }

  if (diffDays < 30) {
    return formatter.format(-diffWeeks, "week");
  }

  if (diffMonths < 12) {
    return formatter.format(-diffMonths, "month");
  }

  return formatter.format(-diffYears, "year");
};

export function ResourceState({ loading, error, empty, children }) {
  if (loading)
    return (
      <div
        aria-busy="true"
        aria-label="Loading"
        className="flex w-full min-h-0 flex-col items-center gap-3 py-16 text-muted"
      >
        <Spinner size="md" />
      </div>
    );

  if (error)
    return (
      <div className="flex w-full min-h-0 flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-danger-soft text-danger">
          <ErrorOutlined fontSize="small" />
        </div>
        <p className="max-w-xs text-sm text-muted">{error}</p>
      </div>
    );

  if (empty)
    return (
      <div className="flex w-full min-h-0 flex-col items-center gap-2 py-16 text-center">
        <p className="max-w-xs text-sm text-muted">{empty}</p>
      </div>
    );

  return children;
}

export function Avatar({ person, className = "" }) {
  if (person?.avatar?.secureUrl)
    return (
      <img
        className={`avatar ${className}`}
        src={person.avatar.secureUrl}
        alt=""
      />
    );

  return (
    <div className={`avatar avatar-${colorFor(person?.id)} ${className}`}>
      {person?.initials || person?.fullName?.slice(0, 2).toUpperCase()}
    </div>
  );
}

// Below is a simple 'useResource' hook that you might need, based on your original code:

import { api } from "./api"; // adjust path to your api.js

export function useResource(url) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: "",
  });

  const reload = async () => {
    if (!url) return null;
    try {
      const { data } = await api.get(url);

      setState({
        data: data.data,
        loading: false,
        error: "",
      });

      return data.data;
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: error.response?.data?.error?.message || "Unable to load data.",
      }));

      return null;
    }
  };

  useEffect(() => {
    if (!url) {
      setState({ data: null, loading: false, error: "" });
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    api
      .get(url, { signal: controller.signal })
      .then(({ data }) => {
        if (active) setState({ data: data.data, loading: false, error: "" });
      })
      .catch((error) => {
        if (active && error.code !== "ERR_CANCELED")
          setState({
            data: null,
            loading: false,
            error:
              error.response?.data?.error?.message || "Unable to load data.",
          });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [url]);

  const setData = (updater) =>
    setState((current) => ({
      ...current,
      data: typeof updater === "function" ? updater(current.data) : updater,
      loading: false,
      error: "",
    }));

  return { ...state, reload, setData };
}
