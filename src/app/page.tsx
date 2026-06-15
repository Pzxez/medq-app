"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { onAuthStateChanged, User, updateProfile } from "firebase/auth";
import { auth, logOut } from "@/lib/firebase/auth";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, orderBy, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, Task, Patient } from "@/lib/firebase/firestore";
import { useAuth } from "@/components/AuthContext";
import Link from "next/link";
import { AlertCircle, Clock, CheckCircle, Users, Activity, Plus, X, ClipboardList, BookOpen } from "lucide-react";


// Advanced Animation Variants
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { type: "spring", stiffness: 80, damping: 15 } 
  },
};

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

export default function GlobalHub() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("Urgent");
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);
  const [patientsCount, setPatientsCount] = useState(0);
  const [scratchpadText, setScratchpadText] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSavingScratchpad, setIsSavingScratchpad] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [newTime, setNewTime] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' }));
  const [handoff, setHandoff] = useState("");
  const [isSavingHandoff, setIsSavingHandoff] = useState(false);
  const [newHandoff, setNewHandoff] = useState("");
  const [handoffList, setHandoffList] = useState<any[]>([]);
  const [readingList, setReadingList] = useState<any[]>([]);
  const [newTopic, setNewTopic] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit' }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.scratchpad) setScratchpadText(data.scratchpad);
          if (data.handoffNote) setHandoff(data.handoffNote);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();

    // Listen to tasks
    const tasksQuery = query(collection(db, "tasks"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setAllTasks(fetchedTasks);
      setUrgentTasks(fetchedTasks.filter(t => !t.completed && (t.priority === 'Urgent' || t.priority === 'STAT' || t.priority === 'High Priority')));
      setIsLoadingData(false);
    });

    // Listen to patients for total count
    const patientsQuery = query(collection(db, "patients"), where("userId", "==", user.uid));
    const unsubscribePatients = onSnapshot(patientsQuery, (snapshot) => {
      setPatientsCount(snapshot.docs.length);
    });

    // Listen to timeline events
    const timelineQuery = query(collection(db, "timeline"), where("userId", "==", user.uid), orderBy("time", "asc"));
    const unsubscribeTimeline = onSnapshot(timelineQuery, (snapshot) => {
      setTimelineEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to reading list
    const readingQuery = query(collection(db, "reading_list"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeReading = onSnapshot(readingQuery, (snapshot) => {
      setReadingList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Listen to handoffs
    const handoffsQuery = query(collection(db, "handoffs"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsubscribeHandoffs = onSnapshot(handoffsQuery, (snapshot) => {
      setHandoffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeTasks();
      unsubscribePatients();
      unsubscribeTimeline();
      unsubscribeReading();
      unsubscribeHandoffs();
    };
  }, [user]);

  const handleSaveScratchpad = async () => {
    if (!user) return;
    setIsSavingScratchpad(true);
    try {
      await setDoc(doc(db, "users", user.uid), { scratchpad: scratchpadText }, { merge: true });
    } catch (error) {
      console.error("Error saving scratchpad:", error);
    } finally {
      setIsSavingScratchpad(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    try {
      await setDoc(doc(db, "tasks", task.id), { completed: !task.completed }, { merge: true });
    } catch (error) {
      console.error("Error toggling task:", error);
    }
  };

  const handleAddEvent = async () => {
    if (!newTime || !newTitle || !user) return;
    try {
      await addDoc(collection(db, "timeline"), {
        time: newTime,
        title: newTitle,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewTime("");
      setNewTitle("");
    } catch (error) {
      console.error("Error adding timeline event:", error);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, "timeline", eventId));
    } catch (error) {
      console.error("Error deleting timeline event:", error);
    }
  };

  const handleSaveHandoff = async () => {
    if (!user) return;
    setIsSavingHandoff(true);
    try {
      await setDoc(doc(db, "users", user.uid), { handoffNote: handoff }, { merge: true });
    } catch (error) {
      console.error("Error saving handoff:", error);
    } finally {
      setIsSavingHandoff(false);
    }
  };

  const handleAddHandoff = async () => {
    if (!newHandoff || !user) return;
    try {
      await addDoc(collection(db, "handoffs"), { 
        text: newHandoff, 
        userId: user.uid, 
        completed: false, 
        createdAt: serverTimestamp() 
      });
      setNewHandoff("");
    } catch (error) {
      console.error("Error adding handoff:", error);
    }
  };

  const handleToggleHandoff = async (id: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, "handoffs", id), { completed: !currentStatus }, { merge: true });
    } catch (error) {
      console.error("Error toggling handoff:", error);
    }
  };

  const handleAddReading = async () => {
    if (!newTopic || !user) return;
    try {
      await addDoc(collection(db, "reading_list"), {
        title: newTopic,
        userId: user.uid,
        completed: false,
        createdAt: serverTimestamp()
      });
      setNewTopic("");
    } catch (error) {
      console.error("Error adding reading list item:", error);
    }
  };

  const handleCompleteReading = async (id: string, currentStatus: boolean) => {
    try {
      await setDoc(doc(db, "reading_list", id), { completed: !currentStatus }, { merge: true });
    } catch (error) {
      console.error("Error completing reading item:", error);
    }
  };

  const handleDeleteReading = async (id: string) => {
    try {
      await deleteDoc(doc(db, "reading_list", id));
    } catch (error) {
      console.error("Error deleting reading item:", error);
    }
  };
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isWardsMenuOpen, setIsWardsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Settings Form State
  const [displayName, setDisplayName] = useState("");
  const [wardRotation, setWardRotation] = useState("Psychiatry");
  
  // UI Display State
  const [uiName, setUiName] = useState("Doctor");

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setUiName(user.displayName?.split(' ')[0] || "Doctor");
    }
  }, [user]);

  const handleLogout = async () => {
    await logOut();
  };
  
  const handleSaveSettings = async () => {
    if (user) {
      try {
        await updateProfile(user, { displayName });
      } catch (error) {
        console.error("Error updating profile:", error);
      }
    }
    setUiName(displayName.split(' ')[0] || "Doctor");
    setIsSettingsOpen(false);
  };



  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key="global-hub"
          variants={pageVariants}
          initial="hidden"
          animate="show"
          exit="exit"
          className="min-h-screen bg-white text-black flex flex-col font-sans"
        >
          {/* Modern Minimalist Header */}
          <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100 w-full">
            <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-12 h-20 flex items-center justify-between w-full">
              {/* Logo */}
              <Link href="/" className="flex items-center space-x-2 cursor-pointer group">
                <svg className="w-6 h-6 text-black group-hover:scale-105 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <h1 className="text-xl font-bold tracking-tight text-black group-hover:text-gray-700 transition-colors">MedQ</h1>
              </Link>
              
              {/* Center Navigation (Desktop) */}
              <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-500">
                <Link href="/" className="text-black hover:text-black transition-colors">Dashboard</Link>
                
                {/* Wards Dropdown */}
                <div 
                  className="relative"
                  onMouseEnter={() => setIsWardsMenuOpen(true)}
                  onMouseLeave={() => setIsWardsMenuOpen(false)}
                >
                  <button 
                    onClick={() => setIsWardsMenuOpen(!isWardsMenuOpen)}
                    className="flex items-center space-x-1 text-gray-500 hover:text-black transition-colors focus:outline-none"
                  >
                    <span>Wards</span>
                    <svg className={`w-3.5 h-3.5 mt-0.5 transition-transform ${isWardsMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  <AnimatePresence>
                    {isWardsMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-100 shadow-lg rounded-2xl py-2 flex flex-col overflow-hidden z-50"
                      >
                        <Link href="/ward/psychiatry" className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors block">Psychiatry</Link>
                        <Link href="#" className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors block">Internal Medicine</Link>
                        <Link href="#" className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors block">Pediatrics</Link>
                        <Link href="#" className="px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-black transition-colors block">Surgery</Link>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-black font-semibold text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                >
                  {uiName.charAt(0)}
                </button>
                
                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 z-50 overflow-hidden"
                    >
                      <button 
                        onClick={() => { setIsSettingsOpen(true); setIsDropdownOpen(false); }}
                        className="group w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-black transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="group w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3 transition-colors"
                      >
                        <svg className="w-4 h-4 text-red-500 group-hover:text-red-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span className="font-medium">Log out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="container mx-auto px-4 py-6 sm:px-6 md:px-8 lg:py-10 pb-32 flex-1 w-full flex flex-col items-center">
            
            {/* SaaS Hero Section */}
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="flex flex-col items-center text-center w-full mb-16 mt-4"
            >
              <motion.h1 
                variants={fadeUpItem}
                className="text-3xl md:text-4xl lg:text-5xl font-bold text-black tracking-tight"
              >
                {getGreeting()}, {uiName}.
              </motion.h1>
              
              <motion.p 
                variants={fadeUpItem}
                className="text-gray-500 mt-2 text-lg mb-8"
              >
                Here's your clinical overview for today.
              </motion.p>
              
                <div className="flex items-center space-x-4">
                  <div className="bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm font-medium text-black shadow-sm flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    <span>{isLoadingData ? "..." : patientsCount} Total Patients</span>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm font-medium text-black shadow-sm flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-red-500" />
                    <span>{isLoadingData ? "..." : urgentTasks.length} Urgent Tasks</span>
                  </div>
                </div>
            </motion.div>

            {/* 2-COLUMN BENTO GRID (Main Content) */}
            <div className="w-full max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              
              {/* LEFT COLUMN: Urgent Action Queue & Timeline */}
              <div className="col-span-1 lg:col-span-2 flex flex-col gap-10">
                {/* URGENT ACTION QUEUE */}
                <div>
                  <h2 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-500" />
                    Urgent Action Queue
                  </h2>
                  <div className="w-full flex flex-col gap-4">
                    {isLoadingData ? (
                      <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-center h-32">
                        <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                      </div>
                    ) : urgentTasks.length === 0 ? (
                      <div className="p-6 bg-white border border-gray-100 rounded-3xl shadow-sm flex items-center justify-center h-32">
                        <p className="text-gray-400 font-medium">No urgent tasks. You're all caught up!</p>
                      </div>
                    ) : (
                      urgentTasks.map((task) => (
                        <motion.div 
                          key={task.id}
                          variants={fadeUpItem}
                          whileHover={{ y: -2, transition: { duration: 0.2 } }}
                          className="p-5 bg-white border border-red-100 rounded-2xl shadow-sm hover:shadow transition-all flex items-start space-x-4 cursor-pointer"
                        >
                          <div 
                            onClick={() => handleToggleTask(task)}
                            className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:border-black transition-colors bg-white flex-shrink-0"
                          >
                            {task.completed && <CheckCircle className="w-5 h-5 text-black" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-black font-semibold text-base leading-snug">
                              {task.text}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 text-red-700">
                                {task.priority}
                              </span>
                              {task.ward && (
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{task.ward}</span>
                              )}
                              {task.patientId && (
                                <span className="text-[10px] text-gray-400 font-medium uppercase">PID: {task.patientId}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* SHIFT TIMELINE */}
                <div>
                  <h2 className="text-xl font-bold text-black mb-6 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    Shift Timeline
                  </h2>

                  <div className="flex flex-col sm:flex-row gap-3 mb-8 w-full">
                    <input 
                      type="time" 
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full sm:w-auto p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-black"
                    />
                    <input 
                      type="text" 
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Shift event..."
                      className="w-full sm:w-auto flex-grow p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-black"
                    />
                    <button 
                      onClick={handleAddEvent}
                      className="w-full sm:w-auto bg-black text-white px-6 py-2 rounded-full text-xs font-bold shadow-sm hover:bg-gray-800 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="border-l-2 border-gray-100 ml-4 pl-8 space-y-8 relative">
                    {timelineEvents.length === 0 ? (
                      <p className="text-sm text-gray-400 font-medium ml-4 mt-2">No events scheduled for today. Add one above.</p>
                    ) : (
                      timelineEvents.map((event, index) => {
                        const isPast = event.time < currentTime;
                        return (
                          <div key={event.id} className="relative group">
                            <div className={`absolute -left-[41px] top-1 bg-white border-4 rounded-full w-5 h-5 ${isPast ? 'border-gray-200' : 'border-black shadow-sm'}`} />
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className={`text-sm flex items-center gap-2 ${isPast ? 'opacity-40 text-gray-400 line-through decoration-gray-300' : 'text-black font-semibold'}`}>
                                  {event.time} - {event.title}
                                </p>
                              </div>
                              <button 
                                onClick={() => handleDeleteEvent(event.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Global Scratchpad */}
              <motion.div 
                variants={fadeUpItem}
                className="col-span-1"
              >
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-[500px]">
                  <div className="flex items-center space-x-2 mb-4">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    <h3 className="text-sm font-bold text-gray-700">Global Scratchpad</h3>
                  </div>
                  <textarea 
                    value={scratchpadText}
                    onChange={(e) => setScratchpadText(e.target.value)}
                    className="flex-1 w-full text-sm text-black placeholder-gray-400 bg-gray-50 border border-gray-100 rounded-2xl p-4 focus:ring-1 focus:ring-black focus:bg-white transition-colors resize-none outline-none custom-scrollbar mb-4"
                    placeholder="Jot down quick labs, vitals, or thoughts before organizing them..."
                  />
                  <div className="flex justify-end">
                    <button 
                      onClick={handleSaveScratchpad}
                      disabled={isSavingScratchpad}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors ${
                        isSavingScratchpad 
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed" 
                          : "bg-black text-white hover:bg-gray-800"
                      }`}
                    >
                      {isSavingScratchpad ? "Saving..." : "Save Notes"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* BOTTOM SECTION: Handoff & Reading List */}
            <div className="w-full max-w-6xl mx-auto px-4 mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                
                {/* SHIFT HANDOFF MODULE */}
                <motion.div variants={fadeUpItem} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-[300px]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <ClipboardList className="w-5 h-5 text-gray-500" />
                      <h3 className="text-lg font-bold text-black">Shift Handoff</h3>
                    </div>
                  </div>
                  
                  <div className="mb-6 flex flex-col gap-2">
                    <textarea 
                      value={newHandoff}
                      onChange={(e) => setNewHandoff(e.target.value)}
                      className="w-full text-sm text-black placeholder-gray-400 bg-gray-50 border border-gray-100 p-3 rounded-2xl focus:ring-1 focus:ring-black focus:bg-white resize-none outline-none custom-scrollbar min-h-[80px]"
                      placeholder="Add a handoff note..."
                    />
                    <div className="flex justify-end">
                      <button 
                        onClick={handleAddHandoff}
                        className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-sm hover:bg-gray-800 transition-colors"
                      >
                        Add Note
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {handoffList.length === 0 ? (
                      <p className="text-sm text-gray-400 font-medium">No handoff history.</p>
                    ) : (
                      handoffList.map((item) => {
                        const dateObj = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
                        const isToday = new Date().toDateString() === dateObj.toDateString();
                        const dateString = isToday 
                          ? `Today, ${dateObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}` 
                          : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                        return (
                          <div key={item.id} className={`flex items-start gap-3 p-3 border border-gray-100 rounded-xl transition-all ${item.completed ? 'bg-gray-50' : 'bg-white hover:shadow-sm'}`}>
                            <div 
                              onClick={() => handleToggleHandoff(item.id, item.completed)}
                              className="mt-0.5 w-4 h-4 rounded-sm border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:border-black transition-colors bg-white flex-shrink-0"
                            >
                              {item.completed && <CheckCircle className="w-4 h-4 text-black" />}
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-medium whitespace-pre-wrap ${item.completed ? 'line-through text-gray-400' : 'text-black'}`}>
                                {item.text}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{dateString}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>

                {/* REQUIRED READING MODULE */}
                <motion.div variants={fadeUpItem} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col h-full min-h-[300px]">
                  <div className="flex items-center space-x-2 mb-6">
                    <BookOpen className="w-5 h-5 text-gray-500" />
                    <h3 className="text-lg font-bold text-black">Required Reading</h3>
                  </div>
                  
                  <div className="flex gap-2 mb-6">
                    <input 
                      type="text" 
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      placeholder="Topic to study..."
                      className="flex-grow p-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-black"
                    />
                    <button 
                      onClick={handleAddReading}
                      className="bg-black text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-800 transition-colors"
                    >
                      Add
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {readingList.length === 0 ? (
                      <p className="text-sm text-gray-400 font-medium">No reading backlog. You're caught up!</p>
                    ) : (
                      readingList.map((item) => (
                        <div key={item.id} className={`flex items-start justify-between group p-3 border border-gray-100 rounded-xl transition-all ${item.completed ? 'bg-gray-50' : 'bg-white hover:shadow-sm'}`}>
                          <div className="flex items-center gap-3">
                            <div 
                              onClick={() => handleCompleteReading(item.id, item.completed)}
                              className="w-4 h-4 rounded-sm border-2 border-gray-300 flex items-center justify-center cursor-pointer hover:border-black transition-colors bg-white flex-shrink-0"
                            >
                              {item.completed && <CheckCircle className="w-4 h-4 text-black" />}
                            </div>
                            <p className={`text-sm font-medium ${item.completed ? 'line-through text-gray-400' : 'text-black'}`}>{item.title}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteReading(item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
                
              </div>
            </div>
          </main>
        </motion.div>
      </AnimatePresence>

      {/* Settings Modal Overlay */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 font-sans">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsSettingsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 25 }}
              className="relative bg-white rounded-3xl shadow-xl w-full max-w-md p-8 z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold text-black tracking-tight">Account Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)} 
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:text-black hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Jane Doe"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Ward Rotation</label>
                  <select 
                    value={wardRotation}
                    onChange={(e) => setWardRotation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-black bg-white appearance-none"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
                  >
                    <option value="Psychiatry">Psychiatry</option>
                    <option value="Internal Medicine">Internal Medicine</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Surgery">Surgery</option>
                    <option value="OB/GYN">OB/GYN</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-10 flex justify-end">
                <button 
                  onClick={handleSaveSettings}
                  className="bg-black text-white px-8 py-3 rounded-full font-medium text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
