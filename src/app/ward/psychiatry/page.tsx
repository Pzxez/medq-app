"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Patient, Task, subscribeToPatientTasks, subscribeToWardTasks, addTask, toggleTaskStatus, updatePatientNotes, seedInitialPatients } from "@/lib/firebase/firestore";
import { collection, addDoc, onSnapshot, query, orderBy, where, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import { useAuth } from "@/components/AuthContext";

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function PsychiatryWard() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'hub' | 'tracker'>('hub');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [sortBy, setSortBy] = useState<'bed' | 'acuity'>('bed');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [wardTasks, setWardTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState('Routine');
  const [newTaskCategory, setNewTaskCategory] = useState('General');
  const [quickNote, setQuickNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);

  // Modal States
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  const [newAlertText, setNewAlertText] = useState("");
  const [newAlertType, setNewAlertType] = useState<"warning" | "critical">("warning");
  const [newAlertPatient, setNewAlertPatient] = useState("");
  const [patientToDelete, setPatientToDelete] = useState<string | null>(null);
  const [newContactName, setNewContactName] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");

  const [newBed, setNewBed] = useState("");
  const [newInitials, setNewInitials] = useState("");
  const [newDx, setNewDx] = useState("");
  const [newStatus, setNewStatus] = useState<'Stable' | 'Observation' | 'Critical'>('Stable');
  const [newAttending, setNewAttending] = useState("");
  const [newAdmissionDate, setNewAdmissionDate] = useState(new Date().toISOString().split('T')[0]);

  const [timeData, setTimeData] = useState({ date: '', shift: '', greeting: 'Good day' });

  useEffect(() => {
    const d = new Date();
    const currentHour = d.getHours();
    setTimeData({
      date: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      shift: currentHour >= 7 && currentHour < 15 ? 'Morning Shift' : currentHour >= 15 && currentHour < 23 ? 'Evening Shift' : 'Night Shift',
      greeting: currentHour < 12 ? 'Good morning' : currentHour < 18 ? 'Good afternoon' : 'Good evening'
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'patients'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(docsData.filter(p => p.ward === 'psychiatry'));
      setIsLoadingPatients(false);
    }, (error) => {
      console.error("Error fetching patients:", error);
      setIsLoadingPatients(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToWardTasks(user.uid, "psychiatry", (data) => setWardTasks(data));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'my_alerts'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlerts(docsData);
    }, (error) => {
      console.error("Error fetching alerts:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'contacts'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setContacts(docsData);
    }, (error) => {
      console.error("Error fetching contacts:", error);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (selectedPatientId && user) {
      const unsubscribe = subscribeToPatientTasks(user.uid, selectedPatientId, (data) => setTasks(data));
      return () => unsubscribe();
    } else {
      setTasks([]);
    }
  }, [selectedPatientId, user]);

  useEffect(() => {
    if (selectedPatientId) {
      const patient = patients.find(p => p.id === selectedPatientId);
      if (patient && (patient as any).quickNotes) {
        setQuickNote((patient as any).quickNotes);
      } else {
        setQuickNote("");
      }
    } else {
      setQuickNote("");
    }
  }, [selectedPatientId, patients]);

  const totalTasks = wardTasks.length;
  const completedTasks = wardTasks.filter(t => t.completed).length;
  const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
  const activeAdmissions = patients.length;
  const pendingDischarges = 0;
  
  const criticalCount = patients.filter(p => p.status === 'Critical' || (p.status as any) === 'Urgent').length;

  const handleAddTask = async () => {
    if (!selectedPatientId || !newTaskText.trim() || !user) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        text: newTaskText,
        priority: newTaskPriority,
        category: newTaskCategory,
        patientId: selectedPatientId,
        userId: user.uid,
        completed: false,
        ward: 'psychiatry',
        createdAt: serverTimestamp()
      });
      setNewTaskText("");
      setNewTaskPriority('Routine');
      setNewTaskCategory('General');
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleToggleTask = async (task: Task) => {
    if (!selectedPatientId) return;
    await toggleTaskStatus(task.id, task.completed);
  };

  const handleUpdateNotes = async (notes: string) => {
    if (!selectedPatientId) return;
    await updatePatientNotes(selectedPatientId, notes);
  };

  const handleSaveQuickNote = async () => {
    if (!selectedPatientId || !user) return;
    setIsSavingNote(true);
    try {
      await updateDoc(doc(db, 'patients', selectedPatientId), { quickNotes: quickNote });
    } catch (error) {
      console.error("Error saving quick note:", error);
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleAddAlertClick = () => {
    setIsAddingAlert(true);
  };

  const handleSaveAlert = async () => {
    if (!newAlertText.trim() || !user) return;
    try {
      await addDoc(collection(db, 'my_alerts'), {
        userId: user.uid,
        text: newAlertText,
        type: newAlertType,
        relatedBed: newAlertPatient || null,
        createdAt: serverTimestamp()
      });
      setIsAddingAlert(false);
      setNewAlertText("");
      setNewAlertType("warning");
      setNewAlertPatient("");
    } catch (error) {
      console.error("Error adding alert:", error);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'my_alerts', alertId));
    } catch (error) {
      console.error("Error resolving alert:", error);
    }
  };

  const handleAddContactClick = () => {
    setIsAddingContact(true);
  };

  const handleSaveContact = async () => {
    if (!newContactName || !newContactPhone || !user) return;
    try {
      await addDoc(collection(db, 'contacts'), {
        userId: user.uid,
        name: newContactName,
        role: newContactRole || "On-Call",
        phone: newContactPhone,
        createdAt: serverTimestamp()
      });
      setIsAddingContact(false);
      setNewContactName("");
      setNewContactRole("");
      setNewContactPhone("");
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  const handleSavePatient = async () => {
    if (!newBed || !newInitials || !newDx || !newAttending || !newAdmissionDate || !user) return;
    setIsSavingPatient(true);
    try {
      const identifier = `${newBed} (${newInitials})`;
      const shortDx = newDx.length > 5 ? newDx.substring(0, 3).toUpperCase() : newDx.toUpperCase();
      
      await addDoc(collection(db, 'patients'), {
        userId: user.uid,
        ward: 'psychiatry',
        identifier,
        diagnosis: newDx,
        shortDx,
        status: newStatus,
        attending: newAttending,
        admissionDate: newAdmissionDate,
        createdAt: serverTimestamp()
      });

      setIsAddingPatient(false);
      setNewBed("");
      setNewInitials("");
      setNewDx("");
      setNewStatus('Stable');
      setNewAttending("");
      setNewAdmissionDate(new Date().toISOString().split('T')[0]);
    } catch (error) {
      console.error("Error saving patient:", error);
    } finally {
      setIsSavingPatient(false);
    }
  };

  const executeDeletePatient = async () => {
    if (!patientToDelete) return;
    try {
      await deleteDoc(doc(db, 'patients', patientToDelete));
      if (selectedPatientId === patientToDelete) setSelectedPatientId(null);
      setPatientToDelete(null);
    } catch (error) {
      console.error("Error deleting patient:", error);
    }
  };

  const calculateHospitalDay = (admissionDate: string) => {
    if (!admissionDate) return "";
    const today = new Date();
    const admitted = new Date(admissionDate);
    today.setHours(0, 0, 0, 0);
    admitted.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(today.getTime() - admitted.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return `HD ${diffDays + 1}`;
  };

  const sortedPatients = [...patients].sort((a, b) => {
    if (sortBy === 'bed') {
      return a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
    } else {
      const weight = { Critical: 3, Observation: 2, Stable: 1 };
      return (weight[b.status as keyof typeof weight] || 0) - (weight[a.status as keyof typeof weight] || 0);
    }
  });

  const selectedPatient = selectedPatientId ? patients.find((p) => p.id === selectedPatientId) : null;

  return (
    <div className="min-h-screen bg-white text-black font-sans pb-32 overflow-x-hidden">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100 w-full pt-4 pb-4">
        <div className="container mx-auto px-4 md:px-8 lg:px-12 flex items-center justify-between">
          <button 
            onClick={() => currentView === 'hub' ? window.location.href = '/' : setCurrentView('hub')}
            className="flex items-center space-x-2 text-gray-500 hover:text-black transition-colors font-medium text-sm w-48 focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>{currentView === 'hub' ? "Back to Dashboard" : "Back to Ward Hub"}</span>
          </button>
          <div className="flex-1 pl-4 md:pl-8">
            {timeData.date && (
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase mb-1">
                {timeData.date} • {timeData.shift}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-black">Psychiatry Ward</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {currentView === 'hub' ? `${timeData.greeting}, ขี้หมา.` : "Here's your ward overview."}
            </p>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {currentView === 'hub' && (
          <motion.div 
            key="hub"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-6xl mx-auto mt-6 space-y-8 px-4"
          >
            {/* TOP SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Column 1: Daily Progress */}
              <div className="col-span-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center relative overflow-hidden">
                <h3 className="absolute top-6 left-6 text-sm font-semibold text-gray-400 uppercase tracking-wider">Daily Progress</h3>
                
                {/* Custom SVG Donut Chart */}
                <div className="relative w-40 h-40 mt-8 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="transparent" 
                      stroke="#f3f4f6" /* gray-100 */
                      strokeWidth="12" 
                    />
                    <circle 
                      cx="50" cy="50" r="40" 
                      fill="transparent" 
                      stroke="#000000" 
                      strokeWidth="12" 
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - (progressPercentage / 100))}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute text-3xl font-black text-black">{progressPercentage}%</span>
                </div>
                <p className="mt-6 text-sm font-medium text-gray-500">{completedTasks} of {totalTasks} tasks completed</p>
              </div>

              {/* Column 2: My Shift Alerts & Quick Stats */}
              <div className="col-span-1 lg:col-span-2 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-xl font-bold text-black tracking-tight">My Shift Alerts</h3>
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                  <button
                    onClick={handleAddAlertClick}
                    className="bg-gray-50 text-gray-600 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 shadow-sm transition-colors"
                  >
                    + Add
                  </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto max-h-40 custom-scrollbar pr-2">
                  {alerts.length > 0 ? (
                    alerts.map((alert) => (
                      <div 
                        key={alert.id} 
                        className={`px-4 py-3 rounded-2xl flex items-center justify-between group ${
                          alert.type === 'critical' ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          {alert.type === 'critical' ? (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          ) : (
                            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{alert.text}</span>
                            {alert.relatedBed && (
                              <span className="text-xs opacity-70 mt-0.5">Ref: {alert.relatedBed}</span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleResolveAlert(alert.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded-full transition-all focus:outline-none"
                          title="Resolve Alert"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-sm font-medium">
                      No active alerts for the ward.
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 flex items-center space-x-4">
                  <div className="bg-gray-50 text-black px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 shadow-sm flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    <span>{activeAdmissions} Active Admissions</span>
                  </div>
                  <div className="bg-gray-50 text-black px-4 py-2 rounded-full text-sm font-semibold border border-gray-200 shadow-sm flex items-center space-x-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span>{pendingDischarges} Pending Discharges</span>
                  </div>
                </div>
              </div>

              {/* Column 4: On-Call Team */}
              <div className="col-span-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">On-Call Directory</h3>
                  <button
                    onClick={handleAddContactClick}
                    className="bg-gray-50 text-gray-600 hover:text-black hover:bg-gray-100 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 shadow-sm transition-colors"
                  >
                    + Add
                  </button>
                </div>
                
                <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-40">
                  {contacts.map(contact => (
                    <a 
                      key={contact.id} 
                      href={`tel:${contact.phone}`}
                      className="block p-3 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-white hover:border-gray-200 transition-colors cursor-pointer group shadow-sm hover:shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm transition-colors mt-0.5 ${
                          contact.name.includes("Crisis") 
                            ? "bg-red-50 text-red-600 border border-red-100 group-hover:bg-red-100" 
                            : "bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-100"
                        }`}>
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0 w-full">
                          <span className={`font-semibold text-sm break-words whitespace-normal transition-colors ${
                            contact.name.includes("Crisis") ? "text-red-700 group-hover:text-red-800" : "text-black group-hover:text-blue-600"
                          }`}>{contact.name}</span>
                          <span className={`text-xs break-words whitespace-normal ${
                            contact.name.includes("Crisis") ? "text-red-500" : "text-gray-500"
                          }`}>{contact.role}</span>
                          <div className={`mt-1 flex items-center gap-1 text-xs font-medium transition-colors ${
                            contact.name.includes("Crisis") ? "text-red-400 group-hover:text-red-600" : "text-blue-500 group-hover:text-blue-600"
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            <span>{contact.phone}</span>
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION */}
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto"
            >
              {/* Card 1: Patient Tracker */}
              <motion.div 
                variants={fadeUpItem}
                onClick={() => setCurrentView('tracker')}
                className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group text-center flex flex-col items-center"
              >
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform border border-gray-100">
                  <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-black mb-1">Patient Tracker</h3>
                <p className="text-sm text-gray-500">Manage cases and tasks</p>
                <div className="mt-4 flex justify-center w-full">
                  {criticalCount > 0 ? (
                    <span className="bg-red-50 text-red-600 text-[10px] font-bold px-3 py-1 rounded-full">{criticalCount} Critical</span>
                  ) : (
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-3 py-1 rounded-full">All Stable</span>
                  )}
                </div>
              </motion.div>

              {/* Card 2: DSM-5 (Disabled Placeholder) */}
              <motion.div 
                variants={fadeUpItem}
                className="bg-gray-50 border border-gray-200 rounded-3xl p-6 opacity-60 pointer-events-none select-none cursor-not-allowed flex flex-col items-center text-center relative"
              >
                <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4 border border-gray-200">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-400 mb-1 flex items-center justify-center">
                  DSM-5 & Mnemonics
                  <span className="ml-2 px-2 py-0.5 text-[9px] font-bold tracking-widest text-gray-500 bg-gray-200 rounded-full uppercase">Coming Soon</span>
                </h3>
                <p className="text-sm text-gray-400">Quick criteria review</p>
                <div className="mt-4 bg-gray-100 rounded-xl px-3 py-2 text-xs font-medium text-gray-400 border border-gray-200">
                  Top searched: MDD, Bipolar I
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {currentView === 'tracker' && (
          <motion.div 
            key="tracker"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-8 max-w-7xl mx-auto px-4"
          >
            {/* LEFT PANEL (Master) */}
            <div className={`col-span-1 md:col-span-4 bg-gray-50 rounded-3xl p-4 border border-gray-100 flex-col h-[80vh] overflow-hidden ${selectedPatientId ? 'hidden lg:flex' : 'flex'}`}>
              <div className="flex items-center justify-between mb-6 px-2 pt-2">
                <h2 className="text-xl font-bold text-black tracking-tight">My Patients</h2>
                <div className="flex items-center space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'bed' | 'acuity')}
                    className="bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-full px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-black cursor-pointer shadow-sm"
                  >
                    <option value="bed">Sort: Bed</option>
                    <option value="acuity">Sort: Acuity</option>
                  </select>
                  <button 
                    onClick={() => setIsAddingPatient(true)}
                    className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm hover:shadow-md transition-all"
                  >
                    + Add Patient
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">


                {isLoadingPatients ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-4 rounded-2xl animate-pulse flex flex-col gap-2 border border-transparent">
                      <div className="h-5 bg-gray-200 rounded-full w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded-full w-full mt-1"></div>
                      <div className="h-3 bg-gray-200 rounded-full w-1/2 mt-1"></div>
                    </div>
                  ))
                ) : patients.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400 mt-4">
                    No patients assigned to this ward.
                  </div>
                ) : (
                  sortedPatients.map((patient) => {
                    const isActive = selectedPatientId === patient.id;
                    const statusColors = {
                      Stable: "bg-green-500",
                      Observation: "bg-yellow-500",
                      Critical: "bg-red-500"
                    };
                    return (
                      <div
                        key={patient.id}
                        onClick={() => setSelectedPatientId(patient.id)}
                        className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                          isActive 
                            ? "bg-white border-gray-200 shadow-sm" 
                            : "bg-transparent border-transparent hover:bg-gray-100"
                        }`}
                      >
                        <h3 className={`font-bold flex items-center gap-2 ${isActive ? "text-black" : "text-gray-700"}`}>
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColors[patient.status] || 'bg-gray-300'}`} />
                          <span className="truncate">{patient.identifier}</span>
                          {patient.admissionDate && (
                            <span className="ml-auto bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              {calculateHospitalDay(patient.admissionDate)}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-1 mt-1 pl-4">{patient.diagnosis}</p>
                        {patient.attending && (
                          <p className="text-xs text-gray-400 mt-1 font-medium pl-4">Staff: {patient.attending}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT PANEL (Detail) */}
            <div className={`col-span-1 md:col-span-8 bg-white rounded-3xl p-8 border border-gray-200 shadow-sm flex-col h-auto ${!selectedPatientId ? 'hidden lg:flex' : 'flex'}`}>
              <AnimatePresence mode="wait">
                {selectedPatient ? (
                  <motion.div
                    key={`patient-${selectedPatient.id}`}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full"
                  >
                    {/* Detail Header */}
                    <button 
                      onClick={() => setSelectedPatientId(null)} 
                      className="flex lg:hidden items-center space-x-2 text-gray-500 hover:text-black font-medium text-sm mb-6 transition-colors focus:outline-none"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                      <span>Back to Patients</span>
                    </button>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center space-x-4">
                        <h2 className="text-3xl font-bold text-black tracking-tight">
                          {selectedPatient.identifier}
                        </h2>
                        <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                          {selectedPatient.shortDx}
                        </span>
                      </div>
                      <button
                        onClick={() => setPatientToDelete(selectedPatient.id)}
                        className="text-red-500 text-xs font-bold hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors border border-transparent hover:border-red-100"
                      >
                        Discharge / Remove
                      </button>
                    </div>

                    {/* Task Input Area */}
                    <div className="border border-gray-200 rounded-2xl p-3 bg-white shadow-sm focus-within:border-black transition-colors mb-8">
                      <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                        placeholder="Type a new order or task..."
                        className="outline-none ring-0 w-full bg-transparent text-black placeholder-gray-400 text-base"
                      />
                      <div className="mt-3 flex justify-between items-center">
                        <div className="flex gap-2">
                          <select 
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value)}
                            className="text-xs font-medium bg-gray-50 border-none rounded-lg px-2 py-1 cursor-pointer hover:bg-gray-100 focus:ring-0 outline-none text-gray-700"
                          >
                            <option value="Routine">Routine</option>
                            <option value="Urgent">Urgent</option>
                            <option value="STAT">STAT</option>
                          </select>
                          <select 
                            value={newTaskCategory}
                            onChange={(e) => setNewTaskCategory(e.target.value)}
                            className="text-xs font-medium bg-gray-50 border-none rounded-lg px-2 py-1 cursor-pointer hover:bg-gray-100 focus:ring-0 outline-none text-gray-700"
                          >
                            <option value="General">General</option>
                            <option value="Lab">Lab</option>
                            <option value="Imaging">Imaging</option>
                            <option value="Medication">Medication</option>
                            <option value="Consult">Consult</option>
                          </select>
                        </div>
                        <button 
                          onClick={handleAddTask}
                          className="px-4 py-1.5 bg-black text-white rounded-lg font-medium text-xs hover:bg-gray-800 transition-colors shadow-sm"
                        >
                          Add Task
                        </button>
                      </div>
                    </div>

                    {/* Task List */}
                    <div className="mb-8">
                      <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="space-y-3"
                      >
                        {tasks.length > 0 ? (
                          tasks.map((task) => (
                            <motion.div 
                              variants={fadeUpItem}
                              key={task.id} 
                              className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors group bg-white shadow-sm"
                            >
                              <div className="flex items-center space-x-4 flex-1">
                                <div 
                                  onClick={() => handleToggleTask(task)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${task.completed ? 'bg-black border-black text-white' : 'border-gray-300 hover:border-black'}`}
                                >
                                  {task.completed && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                                </div>
                                <span className={`text-base font-medium ${task.completed ? 'text-gray-400 line-through' : 'text-black'}`}>
                                  {task.text}
                                </span>
                              </div>
                              <div className="flex items-center space-x-3 ml-4">
                                {(task as any).category && (task as any).category !== "General" && (
                                  <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold hidden sm:block">
                                    {(task as any).category}
                                  </span>
                                )}
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${
                                  task.priority === "STAT" 
                                    ? "bg-red-100 text-red-700" 
                                    : task.priority === "Urgent" 
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-gray-100 text-gray-600"
                                }`}>
                                  {task.priority || "Routine"}
                                </span>
                              </div>
                            </motion.div>
                          ))
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-gray-400 font-medium">No active tasks for this patient.</p>
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Quick Notes Section */}
                    <div className="mt-auto">
                      <label className="block text-sm font-bold text-gray-700 mb-3">Patient Quick Notes</label>
                      <textarea 
                        className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black resize-none shadow-sm"
                        rows={4}
                        value={quickNote}
                        onChange={(e) => setQuickNote(e.target.value)}
                        placeholder="Enter quick notes, updates, or handoff details here..."
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={handleSaveQuickNote}
                          disabled={isSavingNote}
                          className="px-4 py-2 bg-black text-white rounded-full font-medium text-xs hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-70"
                        >
                          {isSavingNote ? "Saving..." : "Save Note"}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty-state"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col h-full items-center justify-center text-center"
                  >
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-6 text-gray-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="text-gray-400 font-medium text-lg">Select a patient from the sidebar</p>
                    <p className="text-gray-400 text-sm mt-1">to manage their workspace.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
        

      </AnimatePresence>

      {/* ADD PATIENT MODAL */}
      <AnimatePresence>
        {isAddingPatient && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-500/30 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-lg border border-gray-100"
            >
              <h2 className="text-2xl font-bold text-black mb-6">Add New Patient</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Bed Number</label>
                  <input
                    type="text"
                    value={newBed}
                    onChange={(e) => setNewBed(e.target.value)}
                    placeholder="e.g. Bed 15"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Patient Initials</label>
                  <input
                    type="text"
                    value={newInitials}
                    onChange={(e) => setNewInitials(e.target.value)}
                    placeholder="e.g. K.M."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Diagnosis</label>
                  <input
                    type="text"
                    value={newDx}
                    onChange={(e) => setNewDx(e.target.value)}
                    placeholder="e.g. Major Depressive Disorder"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Acuity Status</label>
                  <div className="flex gap-3">
                    {(['Stable', 'Observation', 'Critical'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setNewStatus(s)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                          newStatus === s 
                            ? s === 'Stable' ? 'bg-green-50 border-green-200 text-green-700' 
                              : s === 'Observation' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                              : 'bg-red-50 border-red-200 text-red-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {s === 'Observation' ? 'Observe' : s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Attending Staff</label>
                    <input
                      type="text"
                      value={newAttending}
                      onChange={(e) => setNewAttending(e.target.value)}
                      placeholder="e.g. Dr. Smith"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Admission Date</label>
                    <input
                      type="date"
                      value={newAdmissionDate}
                      onChange={(e) => setNewAdmissionDate(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-8">
                <button
                  onClick={() => setIsAddingPatient(false)}
                  className="px-5 py-2.5 text-gray-600 font-medium text-sm hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePatient}
                  disabled={isSavingPatient}
                  className={`px-5 py-2.5 rounded-xl font-medium text-sm shadow-sm transition-colors ${
                    isSavingPatient ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-black text-white hover:bg-gray-800"
                  }`}
                >
                  {isSavingPatient ? "Saving..." : "Save Patient"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD CONTACT MODAL */}
      <AnimatePresence>
        {isAddingContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-96 shadow-lg border border-gray-100 flex flex-col"
            >
              <h2 className="text-xl font-bold text-black mb-5">Add On-Call Contact</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="e.g. Dr. Jane"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Role</label>
                  <input
                    type="text"
                    value={newContactRole}
                    onChange={(e) => setNewContactRole(e.target.value)}
                    placeholder="e.g. Attending"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone Number</label>
                  <input
                    type="tel"
                    value={newContactPhone}
                    onChange={(e) => setNewContactPhone(e.target.value)}
                    placeholder="e.g. 0812345678"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsAddingContact(false)}
                  className="px-4 py-2 text-gray-600 font-medium text-sm hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveContact}
                  className="px-5 py-2 bg-black text-white rounded-full font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {patientToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-96 shadow-xl border border-gray-100 flex flex-col items-center text-center"
            >
              <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-black mb-2">Discharge Patient</h2>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to remove this patient from the tracker? This action cannot be undone.
              </p>
              
              <div className="flex items-center justify-center space-x-3 w-full">
                <button
                  onClick={() => setPatientToDelete(null)}
                  className="px-4 py-2 rounded-full text-gray-600 hover:bg-gray-100 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={executeDeletePatient}
                  className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 font-medium text-sm transition-colors shadow-sm"
                >
                  Confirm Discharge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD WARD ALERT MODAL */}
      <AnimatePresence>
        {isAddingAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-96 shadow-xl border border-gray-100 flex flex-col"
            >
              <h2 className="text-xl font-bold text-black mb-5">Add Personal Reminder</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Reminder Note</label>
                  <textarea
                    value={newAlertText}
                    onChange={(e) => setNewAlertText(e.target.value)}
                    placeholder="What do you need to remember?"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400 text-sm resize-none custom-scrollbar"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Urgency</label>
                  <div className="flex gap-3">
                    {(['warning', 'critical'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewAlertType(type)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                          newAlertType === type 
                            ? type === 'critical' 
                              ? 'bg-red-50 border-red-200 text-red-700' 
                              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {type === 'warning' ? 'Just a Note' : 'High Priority'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Related Bed/Patient (Optional)</label>
                  <input
                    type="text"
                    value={newAlertPatient}
                    onChange={(e) => setNewAlertPatient(e.target.value)}
                    placeholder="e.g. Bed 8"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black placeholder-gray-400 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsAddingAlert(false)}
                  className="px-4 py-2 text-gray-600 font-medium text-sm hover:text-black transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAlert}
                  className="px-5 py-2 bg-black text-white rounded-full font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm"
                >
                  Save Reminder
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
