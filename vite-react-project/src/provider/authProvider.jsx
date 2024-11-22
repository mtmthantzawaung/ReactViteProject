import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("isAuthenticated") === "true";
  });

  const login = (credentials) => {
    if (
      credentials.email === "admin@gmail.com" &&
      credentials.password === "@Dmin123"
    ) {
      setIsAuthenticated(true);
      sessionStorage.setItem("isAuthenticated", "true");
    } else {
      alert("Invaild credentials");
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("isAuthenticated");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
