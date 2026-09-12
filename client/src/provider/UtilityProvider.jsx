import axios from 'axios';
import { createContext, useEffect, useState } from 'react'
export const Utility = createContext(null);
const UtilityProvider = ({children}) => {
   const [theme, setTheme] = useState(
    localStorage.getItem("kotha-theme") || "light",
  );

   useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("kotha-theme", theme);
  }, [theme]);

   

    

   
    const info={
        theme,
        setTheme
    }
  return (
    <Utility.Provider value={info}>
      {children}
    </Utility.Provider>
  )
}

export default UtilityProvider