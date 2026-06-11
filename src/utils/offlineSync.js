import { addRecordToQueue, getPendingRecords, updateRecordStatus, deleteRecord } from './offlineDB';
import { fetchApi } from './api';
import { v4 as uuidv4 } from 'uuid';

let isSyncing = false;

export const syncPendingRecords = async () => {
  if (isSyncing || !navigator.onLine) return;
  
  const pendingRecords = await getPendingRecords();
  if (pendingRecords.length === 0) return;

  isSyncing = true;
  console.log(`Starting sync for ${pendingRecords.length} records...`);

  for (const record of pendingRecords) {
    // If connection dropped during sync, abort the rest
    if (!navigator.onLine) {
      console.log('Network dropped during sync. Aborting.');
      break;
    }

    try {
      const response = await fetchApi(record.endpoint, {
        method: record.method,
        body: JSON.stringify(record.payload),
      });

      if (response.status === 'success') {
        // We can either delete it or mark it as synced.
        // Let's delete it to keep the DB clean, or mark as 'synced' if we want local history.
        // The requirements say: "Update the record status to Synced". So we keep it as synced.
        // But for CustomerReport, if we keep them forever, it might show duplicates once backend returns them.
        // Actually, let's mark it as 'synced'. When reports are loaded, we can filter out 'synced' offline records 
        // to avoid duplicates, relying on the backend to provide the true synced record.
        await updateRecordStatus(record.localId, 'synced');
        console.log(`Successfully synced record ${record.localId}`);
      } else {
        await updateRecordStatus(record.localId, 'failed', response.message || 'Server error');
        console.error(`Failed to sync record ${record.localId}:`, response.message);
      }
    } catch (error) {
      await updateRecordStatus(record.localId, 'failed', error.message);
      console.error(`Error syncing record ${record.localId}:`, error);
    }
  }

  isSyncing = false;
  console.log('Sync process finished.');
};

export const submitOfflineAware = async (endpoint, method, payload, recordType) => {
  if (navigator.onLine) {
    try {
      const response = await fetchApi(endpoint, {
        method,
        body: JSON.stringify(payload),
      });
      return response;
    } catch (error) {
      // If the fetch fails purely due to network drop exactly at the moment of request, 
      // we can catch it here and fall back to offline storage, or let it fail.
      // But typically, if we are online and it fails, it's a server error.
      // For a better UX, if it's a network error (TypeError), we can queue it.
      if (error.message.includes('fetch') || error.message.includes('network') || !navigator.onLine) {
        console.warn('Network error during online submit, falling back to offline queue', error);
      } else {
        throw error;
      }
    }
  }

  // Offline or network error fallback
  const localId = uuidv4();
  const queuePayload = {
    ...payload,
    local_id: localId, // Add to payload for backend duplicate prevention
  };

  await addRecordToQueue({
    localId,
    endpoint,
    method,
    payload: queuePayload,
    type: recordType
  });

  return {
    status: 'success',
    message: 'Data saved locally. It will be synchronized when the connection is restored.',
    localId,
    isOffline: true
  };
};

