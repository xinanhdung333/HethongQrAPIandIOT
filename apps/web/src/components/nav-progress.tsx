"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function NavProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, restDelta: 0.001 });

  return <motion.div className="fixed left-0 top-0 z-[60] h-[2px] w-full origin-left bg-zinc-950" style={{ scaleX }} />;
}
