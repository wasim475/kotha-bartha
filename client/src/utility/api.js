import axios from 'axios';

import { announceRestriction } from "./restriction";

const apiBaseUrl = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV
    ? "http://localhost:5000/api/v1"
    : "https://kotha-bartha.onrender.com/api/v1"
);
export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

// A banned / muted account is refused server-side; tell the UI so it can explain.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    announceRestriction(error.response?.data?.error?.code);
    return Promise.reject(error);
  },
);
