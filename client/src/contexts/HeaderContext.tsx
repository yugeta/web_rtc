import { createContext, useContext, useState, type ReactNode } from 'react';

interface HeaderContextType {
  center: ReactNode;
  setCenter: (node: ReactNode) => void;
}

const HeaderContext = createContext<HeaderContextType>({ center: null, setCenter: () => {} });

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [center, setCenter] = useState<ReactNode>(null);
  return (
    <HeaderContext.Provider value={{ center, setCenter }}>
      {children}
    </HeaderContext.Provider>
  );
}

export function useHeader() {
  return useContext(HeaderContext);
}
