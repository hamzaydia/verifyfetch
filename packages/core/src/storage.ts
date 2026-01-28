/**
 * IndexedDB Storage for Resumable Downloads
 *
 * Stores download progress and verified chunks so downloads can
 * resume after page reload or network failure.
 */

import type { ChunkedInfo, SRIString } from './types.js';

const DB_NAME = 'verifyfetch';
const DB_VERSION = 1;
const STORE_NAME = 'downloads';

/**
 * State of an in-progress download
 */
export interface DownloadState {
  /** URL being downloaded */
  url: string;

  /** Chunked verification config */
  chunked: ChunkedInfo;

  /** Number of verified chunks */
  verifiedChunks: number;

  /** Total expected size (from Content-Length) */
  totalSize?: number;

  /** Timestamp when download started */
  startedAt: number;

  /** Timestamp of last update */
  lastUpdated: number;

  /** Bytes downloaded and verified so far */
  bytesVerified: number;
}

/**
 * Stored chunk data
 */
export interface StoredChunk {
  /** Download URL (for lookup) */
  url: string;

  /** Chunk index */
  index: number;

  /** Chunk data */
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for download state
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }

      // Store for chunk data
      if (!db.objectStoreNames.contains('chunks')) {
        const chunksStore = db.createObjectStore('chunks', {
          keyPath: ['url', 'index'],
        });
        chunksStore.createIndex('url', 'url', { unique: false });
      }
    };
  });

  return dbPromise;
}

/**
 * Save download state to IndexedDB
 */
export async function saveDownloadState(state: DownloadState): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const request = store.put(state);

    request.onerror = () => {
      reject(new Error(`Failed to save state: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Load download state from IndexedDB
 */
export async function loadDownloadState(url: string): Promise<DownloadState | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const request = store.get(url);

    request.onerror = () => {
      reject(new Error(`Failed to load state: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Delete download state from IndexedDB
 */
export async function deleteDownloadState(url: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, 'chunks'], 'readwrite');

    // Delete state
    const stateStore = tx.objectStore(STORE_NAME);
    stateStore.delete(url);

    // Delete all chunks for this URL
    const chunksStore = tx.objectStore('chunks');
    const index = chunksStore.index('url');
    const request = index.openCursor(IDBKeyRange.only(url));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(`Failed to delete state: ${tx.error?.message}`));
  });
}

/**
 * Save a verified chunk to IndexedDB
 */
export async function saveChunk(url: string, index: number, data: ArrayBuffer): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const store = tx.objectStore('chunks');

    const chunk: StoredChunk = { url, index, data };
    const request = store.put(chunk);

    request.onerror = () => {
      reject(new Error(`Failed to save chunk: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Load all verified chunks for a URL
 */
export async function loadChunks(url: string): Promise<Map<number, ArrayBuffer>> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const store = tx.objectStore('chunks');
    const index = store.index('url');

    const request = index.getAll(IDBKeyRange.only(url));

    request.onerror = () => {
      reject(new Error(`Failed to load chunks: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const chunks = new Map<number, ArrayBuffer>();
      for (const chunk of request.result as StoredChunk[]) {
        chunks.set(chunk.index, chunk.data);
      }
      resolve(chunks);
    };
  });
}

/**
 * Check if IndexedDB is available
 */
export function isStorageAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Clear old downloads (older than maxAge milliseconds)
 */
export async function clearOldDownloads(maxAge: number = 24 * 60 * 60 * 1000): Promise<number> {
  const db = await openDB();
  const cutoff = Date.now() - maxAge;
  let deletedCount = 0;

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, 'chunks'], 'readwrite');
    const stateStore = tx.objectStore(STORE_NAME);
    const chunksStore = tx.objectStore('chunks');

    const index = stateStore.index('lastUpdated');
    const range = IDBKeyRange.upperBound(cutoff);

    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const state = cursor.value as DownloadState;

        // Delete chunks for this URL
        const chunksIndex = chunksStore.index('url');
        const chunksRequest = chunksIndex.openCursor(IDBKeyRange.only(state.url));
        chunksRequest.onsuccess = (e) => {
          const chunksCursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (chunksCursor) {
            chunksCursor.delete();
            chunksCursor.continue();
          }
        };

        // Delete state
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deletedCount);
    tx.onerror = () => reject(new Error(`Failed to clear old downloads: ${tx.error?.message}`));
  });
}

/**
 * Get all in-progress downloads
 */
export async function getAllDownloads(): Promise<DownloadState[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const request = store.getAll();

    request.onerror = () => {
      reject(new Error(`Failed to get downloads: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result || []);
    };
  });
}
