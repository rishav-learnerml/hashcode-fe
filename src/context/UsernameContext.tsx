import { createContext, useContext, useEffect, useState } from "react";

const UsernameContext = createContext<{
  username: string | null;
  setUsername: (u: string) => void;
}>({ username: null, setUsername: () => {} });

export const UsernameProvider = ({ children }: { children: React.ReactNode }) => {
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("devmatch-username");
    if (stored) setUsernameState(stored);
  }, []);

  const setUsername = (u: string) => {
    localStorage.setItem("devmatch-username", u);
    setUsernameState(u);
  };

  return (
    <UsernameContext.Provider value={{ username, setUsername }}>
      {children}
    </UsernameContext.Provider>
  );
};

export const useUsername = () => useContext(UsernameContext);
