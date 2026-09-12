import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || (
  import.meta.env.DEV
    ? "http://localhost:5000/api/v1"
    : "https://kotha-bartha.onrender.com/api/v1"
);
export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});