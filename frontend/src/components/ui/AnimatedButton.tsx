"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface AnimatedButtonProps extends HTMLMotionProps<"button"> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
}

const AnimatedButton = forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    
    const variants = {
      primary: "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[0_0_15px_rgba(192,193,255,0.4)] hover:shadow-[0_0_25px_rgba(192,193,255,0.6)]",
      secondary: "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] shadow-[0_0_15px_rgba(221,183,255,0.4)] hover:shadow-[0_0_25px_rgba(221,183,255,0.6)]",
      accent: "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] shadow-[0_0_15px_rgba(76,215,246,0.4)] hover:shadow-[0_0_25px_rgba(76,215,246,0.6)]",
      ghost: "bg-transparent text-foreground hover:bg-white/5",
      outline: "bg-transparent border border-white/20 text-foreground hover:bg-white/5 hover:border-white/40",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm rounded-lg",
      md: "px-5 py-2.5 text-base rounded-xl font-medium",
      lg: "px-8 py-4 text-lg rounded-2xl font-semibold",
      icon: "p-2 rounded-xl flex items-center justify-center",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition-colors",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
AnimatedButton.displayName = "AnimatedButton";

export { AnimatedButton };
