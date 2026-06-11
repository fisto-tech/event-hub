import { openDB } from 'idb';

const DB_NAME = 'crm_offline_db';
const STORE_NAME = 'sync_queue';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
        store.createIndex('syncStatus', 'syncStatus');
        store.createIndex('createdAt', 'createdAt');
      }
    },
  });
};

export const addRecordToQueue = async (record) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).put({
    ...record,
    createdAt: Date.now(),
    syncStatus: 'pending', // pending, failed, synced
  });
  await tx.done;
};

export const getPendingRecords = async () => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('syncStatus');
  // Get both pending and failed to retry them
  const pending = await index.getAll('pending');
  const failed = await index.getAll('failed');
  return [...pending, ...failed].sort((a, b) => a.createdAt - b.createdAt);
};

export const getAllOfflineRecords = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const updateRecordStatus = async (localId, syncStatus, errorMessage = '') => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const record = await store.get(localId);
  if (record) {
    record.syncStatus = syncStatus;
    if (errorMessage) {
      record.errorMessage = errorMessage;
    } else {
      delete record.errorMessage;
    }
    await store.put(record);
  }
  await tx.done;
};

export const deleteRecord = async (localId) => {
  const db = await initDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).delete(localId);
  await tx.done;
};
