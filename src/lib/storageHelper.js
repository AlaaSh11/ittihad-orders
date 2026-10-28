import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadPhotoFile(file) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith('image/')) {
    console.warn('Rejected non-image upload');
    return null;
  }
  if (file.size > 20 * 1024 * 1024) {
    console.warn('Rejected image exceeding 20MB');
    return null;
  }
  try {
    const filename = `orders/photos/${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, filename);
    const snap = await uploadBytes(storageRef, file);
    return await getDownloadURL(snap.ref);
  } catch (err) {
    console.warn('Firebase Storage file upload failed (offline fallback applied):', err?.message);
    return null;
  }
}

export async function uploadPhotoDataUrl(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
  try {
    const filename = `orders/photos/sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const storageRef = ref(storage, filename);
    const snap = await uploadString(storageRef, dataUrl, 'data_url');
    return await getDownloadURL(snap.ref);
  } catch (err) {
    console.warn('Firebase Storage string upload failed during sync:', err?.message);
    return null;
  }
}
