'use client';

import { useState, useCallback } from 'react';
import { verifyFetch, type SRIString } from 'verifyfetch';

interface UseVerifiedFetchOptions {
  onProgress?: (percent: number) => void;
}

interface UseVerifiedFetchReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  progress: number;
  fetch: (url: string, sri: SRIString) => Promise<T>;
}

/**
 * React hook for verified fetching with progress tracking
 */
export function useVerifiedFetch<T = ArrayBuffer>(
  options: UseVerifiedFetchOptions = {}
): UseVerifiedFetchReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  const fetchData = useCallback(
    async (url: string, sri: SRIString): Promise<T> => {
      setLoading(true);
      setError(null);
      setProgress(0);

      try {
        const response = await verifyFetch(url, {
          sri,
          onProgress: (bytesProcessed, totalBytes) => {
            if (totalBytes) {
              const percent = Math.round((bytesProcessed / totalBytes) * 100);
              setProgress(percent);
              options.onProgress?.(percent);
            }
          },
        });

        // Determine how to parse the response based on content-type
        const contentType = response.headers.get('content-type') || '';
        let result: T;

        if (contentType.includes('application/json')) {
          result = (await response.json()) as T;
        } else {
          result = (await response.arrayBuffer()) as T;
        }

        setData(result);
        setProgress(100);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return { data, loading, error, progress, fetch: fetchData };
}
