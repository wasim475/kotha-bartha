import axios from 'axios';
import { createContext, useEffect, useState } from 'react'
import { api } from '../utility/api';
import Swal from 'sweetalert2';
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

   const restult =await Swal.fire({
              title: "Are you sure?",
              icon: "warning",
              text: "You will be logged out from this account.",
              showCancelButton: true,
              confirmButtonColor: "#3085d6",
              cancelButtonColor: "#d33",
              confirmButtonText: "Log out"
            })

            if(!restult.isConfirmed) return;

            if(restult.isConfirmed){
             
             Swal.fire({
                  position: "center",
                  icon: "success",
                  title: "Logged out.",
                  showConfirmButton: false,
                  timer: 1500
                });

               await api.post("/auth/logout").catch(() => {});
              setUser(null);
            }
    

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