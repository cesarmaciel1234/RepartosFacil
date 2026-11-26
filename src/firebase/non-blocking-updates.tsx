'use client';

import {
  addDoc,
  deleteDoc,
  setDoc,
  updateDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from "@/firebase/local-firestore";

export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions = {}) {
  void setDoc(docRef, data, options);
}

export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  return addDoc(colRef, data);
}

export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  void updateDoc(docRef, data);
}

export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  void deleteDoc(docRef);
}
