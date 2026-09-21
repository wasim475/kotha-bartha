import { api } from "./api";

export const fileOrigin = api.defaults.baseURL.replace(/\/api\/v1$/, "");
export const toFileUrl = (path) => (path ? `${fileOrigin}${path}` : "");
