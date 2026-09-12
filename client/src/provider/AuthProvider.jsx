import axios from 'axios';
import { createContext, useEffect, useState } from 'react'
import { api } from '../utility/api';
export const Auth = createContext(null);
const AuthProvider = ({children}) => {
  
const [user, setUser] = useState(null);
 const [checking, setChecking] = useState(true);
   
 useEffect(() => {
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data.data))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  };
    

   
    const authInfo={
        user,
        setUser,
        logout,
        checking
    }
  return (
    <Auth.Provider value={authInfo}>
      {children}
    </Auth.Provider>
  )
}

export default AuthProvider