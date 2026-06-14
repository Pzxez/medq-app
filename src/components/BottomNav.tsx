"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";

export function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  const leftItems = [
    {
      name: "Home",
      path: "/",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    }
  ];

  const rightItems = [
    {
      name: "Settings",
      path: "/settings",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  const renderItem = (item: any) => {
    const isActive = pathname === item.path;
    return (
      <Link key={item.name} href={item.path} className="flex-1 flex flex-col items-center justify-center space-y-1">
        <motion.div
          whileTap={{ scale: 0.9 }}
          className={`transition-colors ${isActive ? "text-[#B24A32]" : "text-[#2F4F4F]/40"}`}
        >
          {item.icon}
        </motion.div>
        <span 
          className={`text-[10px] font-medium transition-colors ${isActive ? "text-[#B24A32]" : "text-[#2F4F4F]/40"}`}
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <div className="fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe pt-2 px-6 z-50 md:hidden">
      <div className="flex items-center justify-between h-14 relative max-w-md mx-auto">
        
        {/* Left Side Navigation */}
        <div className="flex-1 flex justify-start pl-4">
          {leftItems.map(renderItem)}
        </div>

        {/* Prominent Floating Action Button (FAB) */}
        <div className="flex-shrink-0 relative -top-6">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 rounded-full bg-[#B24A32] text-white shadow-lg flex items-center justify-center border-4 border-[#FAF9F6]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </motion.button>
        </div>

        {/* Right Side Navigation */}
        <div className="flex-1 flex justify-end pr-4">
          {rightItems.map(renderItem)}
        </div>

      </div>
    </div>
  );
}
