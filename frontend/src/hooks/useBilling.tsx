import { useContext } from 'react';
import { BillingContext } from './billing-context';

export function useBilling() {
  const context = useContext(BillingContext);

  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }

  return context;
}
