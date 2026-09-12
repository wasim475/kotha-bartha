import { useEffect, useRef, useState } from "react";

export const realtime = new EventTarget();
export let activeSocket;
export const setActiveSocket = (socket) => {
  activeSocket = socket;
};
export const sendSignal = (to, signal) => activeSocket?.emit("call:signal", { to, signal });

export function useRealtime(eventName, handler) {
  useEffect(() => {
    realtime.addEventListener(eventName, handler);
    return () => realtime.removeEventListener(eventName, handler);
  }, [eventName, handler]);
}

const colorNames = ["blue", "gold", "mint", "coral"];
export const colorFor = (id = "") =>
  colorNames[Number.parseInt(String(id).slice(-2), 16) % colorNames.length] || "blue";

export const formatTime = (date) => {
  if (!date) return "";
  const diffMinutes = -Math.round((Date.now() - new Date(date).getTime()) / 60000);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffMinutes, "minute");
};

export function ResourceState({ loading, error, empty, children }) {
  if (loading)
    return (
      <div className="empty-note">
        <p>Please wait...</p>
      </div>
    );

  if (error)
    return (
      <div className="empty-note">
        <p>{error}</p>
      </div>
    );

  if (empty)
    return (
      <div className="empty-note">
        <p>{empty}</p>
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

import { api } from './api'; // adjust path to your api.js

export function useResource(url) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: "",
  });

 const reload = async () => {
  try {
    const { data } = await api.get(url);

    setState({
      data: data.data,
      loading: false,
      error: "",
    });

    return data.data;
  } catch (error) {
    setState(current => ({
      ...current,
      loading: false,
      error:
        error.response?.data?.error?.message ||
        "Unable to load data.",
    }));

    return null;
  }
};

  useEffect(() => {
    let active = true;
    api.get(url)
      .then(({ data }) => {
        if (active) setState({ data: data.data, loading: false, error: "" });
      })
      .catch(error => {
        if (active)
          setState({
            data: null,
            loading: false,
            error: error.response?.data?.error?.message || "Unable to load data.",
          });
      });
    return () => { active = false; };
  }, [url]);

  const setData = (updater) => setState(current => ({
    ...current,
    data: typeof updater === "function" ? updater(current.data) : updater,
    loading: false,
    error: "",
  }));

  return { ...state, reload, setData };
}
