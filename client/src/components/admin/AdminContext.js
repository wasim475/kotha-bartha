import { createContext, useContext } from "react";

// What the Admin Panel knows about the signed-in staff member: their role and the
// sections the SERVER says they may use (GET /admin/me).
export const AdminContext = createContext({ role: null, sections: [], counts: { reports: 0, support: 0 } });

export const useAdmin = () => useContext(AdminContext);
