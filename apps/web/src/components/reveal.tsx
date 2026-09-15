"use client";

import { motion } from "framer-motion";

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
