import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import {
  initialDashboardDrill,
  isDashboardDrillInitial,
  reduceDashboardDrill,
  type DashboardDrillAction,
  type DashboardDrillState,
} from '@petdate/shared';

type DrillCtx = {
  state: DashboardDrillState;
  dispatch: (action: DashboardDrillAction) => void;
  isInitial: boolean;
};

const DashboardDrillContext = createContext<DrillCtx | null>(null);

/** One drill dimension for every widget on the board. */
export function DashboardDrillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduceDashboardDrill, undefined, () => initialDashboardDrill('day'));
  const value = useMemo(
    () => ({ state, dispatch, isInitial: isDashboardDrillInitial(state) }),
    [state]
  );
  return <DashboardDrillContext.Provider value={value}>{children}</DashboardDrillContext.Provider>;
}

export function useDashboardDrill(): DrillCtx | null {
  return useContext(DashboardDrillContext);
}

export function DashboardDrillResetButton() {
  const drill = useDashboardDrill();
  if (!drill) return null;
  return (
    <button
      type="button"
      className="admin-btn admin-btn--ghost wdg-toolbar-btn"
      disabled={drill.isInitial}
      onClick={() => drill.dispatch({ type: 'reset' })}
      title="بازگشت کل داشبورد به حالت اولیه"
    >
      بازنشانی دریل
    </button>
  );
}
