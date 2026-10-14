import { createContext, useContext } from 'react';

export const TenantContext = createContext<number | null>(null);

export function useSelectedTenant(): number | null {
  return useContext(TenantContext);
}
