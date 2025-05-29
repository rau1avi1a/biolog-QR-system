'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * Fetch inventory-transaction history for a given Item / Chemical id.
 * Returns { data, isLoading, error } like any react-query hook.
 */
export function useItemTransactions(itemId) {
  return useQuery({
    queryKey: ['item-txns', itemId],
    queryFn: () =>
      fetch(`/api/items/${itemId}/transactions`)
        .then((r) => r.json())
        .then((d) => d.transactions),
    enabled: !!itemId            // don’t run until we have an id
  });
}
