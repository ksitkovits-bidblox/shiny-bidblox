// src/services/projectService.ts
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection,
    query,
    where,
    getDocs
  } from 'firebase/firestore';
  import { db } from '../lib/firebase/firebase';
  
  interface ProjectAnalysis {
    content: string;
    generatedAt: string;
    fileCount: number;
  }
  
  export const projectService = {
    async getProject(projectId: string) {
      const docRef = doc(db, 'projects', projectId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    },
  
    async updateAnalysis(projectId: string, analysis: ProjectAnalysis) {
      const docRef = doc(db, 'projects', projectId);
      await updateDoc(docRef, {
        aiAnalysis: {
          content: analysis.content,
          generatedAt: new Date().toISOString(),
          fileCount: analysis.fileCount
        }
      });
    }
  };