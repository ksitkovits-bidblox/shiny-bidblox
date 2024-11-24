// src/lib/firebase/storage.ts

import { 
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
  } from 'firebase/storage';
  import { storage } from './firebase';
  
  export const uploadFile = async (file: File, path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    } catch (error: any) {
      throw new Error(`Error uploading file: ${error.message}`);
    }
  };
  
  export const deleteFile = async (path: string): Promise<void> => {
    try {
      const storageRef = ref(storage, path);
      await deleteObject(storageRef);
    } catch (error: any) {
      throw new Error(`Error deleting file: ${error.message}`);
    }
  };