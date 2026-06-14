"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithGoogle } from "@/lib/firebase/auth";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      // On successful login, redirect to the Global Hub
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Container variants for the entire page transition and staggered children
  const pageVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
    exit: {
      opacity: 0,
      x: -20, // Prepares for right-to-left slide transition
      transition: { ease: "easeInOut", duration: 0.3 },
    },
  };

  // Variants for fade-up elements (subheading, button)
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 70, damping: 15 },
    },
  };

  // Cinematic text-reveal variants
  const textRevealVariants = {
    hidden: { y: "100%" },
    show: {
      y: "0%",
      transition: { ease: [0.33, 1, 0.68, 1], duration: 1 }, // Custom cubic bezier for smooth cinematic reveal
    },
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="login-page"
        variants={pageVariants}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex-1 flex flex-col items-center justify-center h-full min-h-screen px-4 selection:bg-[#B24A32]/20"
      >
        <div className="w-full max-w-md flex flex-col items-center text-center">
          
          {/* Logo / Heading with hidden overflow for text reveal */}
          <div className="overflow-hidden mb-4 pb-2">
            <motion.h1
              variants={textRevealVariants}
              className="text-5xl md:text-6xl font-bold tracking-tight text-[#2F4F4F]"
              style={{ fontFamily: "var(--font-lora), serif" }}
            >
              MedQ
            </motion.h1>
          </div>

          {/* Subheading */}
          <motion.p
            variants={fadeUpVariants}
            className="text-[#2F4F4F]/80 text-lg mb-10 tracking-wide"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            The productivity hub for medical students.
          </motion.p>

          {/* Action Area */}
          <motion.div variants={fadeUpVariants} className="w-full max-w-[320px]">
            <motion.button
              whileTap={{ scale: 0.98 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-3 bg-white border border-[#2F4F4F]/10 py-3.5 px-6 rounded-lg shadow-sm hover:shadow-md transition-shadow disabled:opacity-70 disabled:cursor-not-allowed group"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              {isLoading ? (
                // Custom loading indicator using the accent color
                <div className="w-5 h-5 border-2 border-[#2F4F4F]/10 border-t-[#B24A32] rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-[#2F4F4F] font-medium group-hover:text-[#B24A32] transition-colors">
                    Continue with Google
                  </span>
                </>
              )}
            </motion.button>
          </motion.div>

          {/* Error Message */}
          <motion.div variants={fadeUpVariants} className="mt-6 h-6">
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-[#B24A32] text-sm font-medium"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
}
