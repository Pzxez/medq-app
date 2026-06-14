import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp, getDocs, where, DocumentData, QuerySnapshot } from "firebase/firestore";
import { app } from "./auth";

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Types
export interface Patient {
  id: string;
  ward: string;
  identifier: string;
  diagnosis: string;
  shortDx: string;
  status: 'Stable' | 'Observation' | 'Critical';
  attending: string;
  admissionDate: string;
  notes: string;
  createdAt: number | any;
  updatedAt: number | any;
}

export interface Task {
  id: string;
  patientId: string;
  ward: string;
  text: string;
  priority: 'High Priority' | 'Routine';
  completed: boolean;
  createdAt: number | any;
  updatedAt: number | any;
}

// --- PATIENT OPERATIONS ---

/**
 * Subscribes to patients in a specific ward.
 */
export const subscribeToPatients = (userId: string, ward: string, callback: (patients: Patient[]) => void) => {
  const q = query(collection(db, "patients"), where("userId", "==", userId), where("ward", "==", ward), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const patients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Patient));
    callback(patients);
  });
};

/**
 * Adds a new patient.
 */
export const addPatient = async (userId: string, ward: string, identifier: string, diagnosis: string, shortDx: string, status: 'Stable' | 'Observation' | 'Critical', attending: string, admissionDate: string) => {
  const patientsRef = collection(db, "patients");
  await addDoc(patientsRef, {
    userId,
    ward,
    identifier,
    diagnosis,
    shortDx,
    status,
    attending,
    admissionDate,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

/**
 * Updates a patient's notes.
 */
export const updatePatientNotes = async (patientId: string, notes: string) => {
  const patientRef = doc(db, "patients", patientId);
  await updateDoc(patientRef, {
    notes,
    updatedAt: serverTimestamp()
  });
};

// --- TASK OPERATIONS ---

/**
 * Subscribes to tasks for an entire ward.
 */
export const subscribeToWardTasks = (userId: string, ward: string, callback: (tasks: Task[]) => void) => {
  const q = query(collection(db, "tasks"), where("userId", "==", userId), where("ward", "==", ward), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
    callback(tasks);
  });
};

/**
 * Subscribes to tasks for a specific patient.
 */
export const subscribeToPatientTasks = (userId: string, patientId: string, callback: (tasks: Task[]) => void) => {
  const q = query(collection(db, "tasks"), where("userId", "==", userId), where("patientId", "==", patientId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
    callback(tasks);
  });
};

/**
 * Adds a new task for a patient.
 */
export const addTask = async (userId: string, patientId: string, ward: string, text: string, priority: 'High Priority' | 'Routine') => {
  const tasksRef = collection(db, "tasks");
  await addDoc(tasksRef, {
    userId,
    patientId,
    ward,
    text,
    priority,
    completed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

/**
 * Toggles a task's completion status.
 */
export const toggleTaskStatus = async (taskId: string, currentStatus: boolean) => {
  const taskRef = doc(db, "tasks", taskId);
  await updateDoc(taskRef, {
    completed: !currentStatus,
    updatedAt: serverTimestamp()
  });
};

/**
 * Seed initial mock data (development only)
 */
export const seedInitialPatients = async (userId: string) => {
  const p1Ref = doc(collection(db, "patients"));
  await setDoc(p1Ref, {
    userId,
    ward: "psychiatry",
    identifier: "Bed 5 (A.K.)",
    diagnosis: "Major Depressive Disorder",
    shortDx: "MDD",
    status: "Stable",
    attending: "Dr. Smith",
    admissionDate: new Date().toISOString().split('T')[0],
    notes: "Patient reports feeling slightly better today. Sleep improved.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const p2Ref = doc(collection(db, "patients"));
  await setDoc(p2Ref, {
    userId,
    ward: "psychiatry",
    identifier: "Bed 12 (S.J.)",
    diagnosis: "Schizophrenia",
    shortDx: "SCZ",
    status: "Observation",
    attending: "Dr. Jenkins",
    admissionDate: new Date().toISOString().split('T')[0],
    notes: "Experiencing auditory hallucinations. Denies SI/HI at present.",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  
  // Tasks for p1
  await addTask(userId, p1Ref.id, "psychiatry", "Follow up morning Lithium level", "High Priority");
  await addTask(userId, p1Ref.id, "psychiatry", "Assess for SI/HI during morning rounds", "Routine");
  
  // Tasks for p2
  await addTask(userId, p2Ref.id, "psychiatry", "Administer Haloperidol IM PRN", "High Priority");
};
