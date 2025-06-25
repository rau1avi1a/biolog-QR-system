// app/api/index.js
import { useMemo } from 'react';

/**
 * Generic API client for any resource under /api
 * @param {string} resource - e.g. 'batches', 'files', 'items'
 */
export function apiClient(resource) {
  const base = `/api/${resource}`;

  return {
    list(query = {}) {
      const params = new URLSearchParams(query).toString();
      const url = params ? `${base}?${params}` : base;
      return fetch(url).then(res => res.json());
    },

    get(id, query = {}) {
      const params = new URLSearchParams({ id, ...query }).toString();
      const url = `${base}?${params}`;
      return fetch(url).then(res => res.json());
    },

    create(data) {
      return fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());
    },

    update(id, data) {
      const url = `${base}?id=${encodeURIComponent(id)}`;
      return fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json());
    },

    remove(id) {
      const url = `${base}?id=${encodeURIComponent(id)}`;
      return fetch(url, { method: 'DELETE' }).then(res => res.json());
    },

    custom(action, data = {}, method = 'POST') {
      const url = `${base}?action=${encodeURIComponent(action)}`;
      const options = { method };
      if (method !== 'GET') {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(data);
      }
      return fetch(url, options).then(res => res.json());
    }
  };
}

/**
 * React hook to get an API client for a given resource
 * @param {string} resource - e.g. 'batches', 'files', 'items'
 */
export function useApi(resource) {
  return useMemo(() => apiClient(resource), [resource]);
}
