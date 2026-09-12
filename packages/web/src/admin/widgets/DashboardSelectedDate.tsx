/**
 * Shared selected calendar day for platform dashboard widgets
 * (calendar → daily notes). Null means “today”.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type DashboardSelectedDateValue = {
  selectedIso: string | null;
  setSelectedIso: (iso: string | null) => void;
};

const DashboardSelectedDateContext = createContext<DashboardSelectedDateValue>({
  selectedIso: null,
  setSelectedIso: () => {},
});

export function DashboardSelectedDateProvider({ children }: { children: ReactNode }) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const value = useMemo(() => ({ selectedIso, setSelectedIso }), [selectedIso]);
  return (
    <DashboardSelectedDateContext.Provider value={value}>
      {children}
    </DashboardSelectedDateContext.Provider>
  );
}

export function useDashboardSelectedDate(): DashboardSelectedDateValue {
  return useContext(DashboardSelectedDateContext);
}
