"use client";

import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  hoverEffect?: boolean;
  glowColor?: "primary" | "secondary" | "accent" | "none";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hoverEffect = true, glowColor = "none", children, ...props }, ref) => {
    
    let glowClass = "";
    if (glowColor === "primary") glowClass = "hover:border-[var(--color-primary)] hover:shadow-[0_0_20px_rgba(192,193,255,0.15)]";
    if (glowColor === "secondary") glowClass = "hover:border-[var(--color-secondary)] hover:shadow-[0_0_20px_rgba(221,183,255,0.15)]";
    if (glowColor === "accent") glowClass = "hover:border-[var(--color-accent)] hover:shadow-[0_0_20px_rgba(76,215,246,0.15)]";

    return (
      <motion.div
        ref={ref}
        className={cn(
          "glass rounded-2xl md:rounded-[24px] p-6 relative overflow-hidden",
          hoverEffect && "glass-hover cursor-default",
          hoverEffect && glowClass,
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
GlassCard.displayName = "GlassCard";

export { GlassCard };
