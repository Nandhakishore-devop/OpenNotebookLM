"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Command, Loader2 } from "lucide-react";
import { GlowInput } from "@/components/ui/GlowInput";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate auth flow
    setTimeout(() => {
      setIsLoading(false);
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="flex w-full min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      {/* Left Side: Visual Branding (Hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#060a14] border-r border-white/10 items-center justify-center p-16">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 opacity-40">
          <motion.div 
            animate={{ rotate: 360, scale: [1, 1.2, 1] }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[10%] left-[20%] w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,rgba(192,193,255,0.15)_0%,transparent_50%)]"
          />
          <motion.div 
            animate={{ rotate: -360, scale: [1, 1.5, 1] }} 
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] right-[10%] w-[600px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(76,215,246,0.1)_0%,transparent_50%)]"
          />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <Link href="/">
              <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-6 inline-block">
                OpenNotebook
              </h1>
            </Link>
            <p className="font-body text-2xl text-muted-foreground leading-relaxed mb-12">
              The premium intelligence layer for frontier research teams.
            </p>
          </motion.div>
          
          {/* Abstract UI Preview Element */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 1, delay: 0.2 }}
            className="glass p-8 rounded-2xl relative shadow-2xl"
          >
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-3/4 bg-white/10 rounded-full"></div>
                <div className="h-4 w-1/2 bg-white/5 rounded-full"></div>
                <div className="h-32 w-full bg-gradient-to-br from-primary/10 to-accent/10 rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center shadow-[0_0_20px_rgba(192,193,255,0.3)]">
                    <div className="w-6 h-6 rounded-full bg-primary animate-pulse"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Right Side: Auth Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 sm:p-16 relative">
        <div className="w-full max-w-[420px]">
          {/* Mobile Branding */}
          <div className="lg:hidden mb-12 text-center">
            <Link href="/">
              <h1 className="font-display text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                OpenNotebook
              </h1>
            </Link>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }} 
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h2 className="font-display text-3xl font-bold text-foreground mb-2">
              {isLogin ? "Welcome back" : "Create an account"}
            </h2>
            <p className="text-muted-foreground">
              {isLogin ? "Enter your credentials to access your workspace." : "Join the next generation of research."}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* Social Auth */}
            <button className="w-full h-12 flex items-center justify-center gap-3 bg-surface hover:bg-surface-hover text-foreground border border-white/10 rounded-xl transition-all duration-300 active:scale-[0.98] mb-6">
              <Command className="w-5 h-5" />
              <span className="font-medium">Continue with GitHub</span>
            </button>

            <div className="relative flex items-center mb-6">
              <div className="flex-grow h-px bg-white/10"></div>
              <span className="px-4 text-xs font-mono uppercase tracking-widest text-muted-foreground">or</span>
              <div className="flex-grow h-px bg-white/10"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="popLayout">
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-medium text-foreground ml-1">Full Name</label>
                    <GlowInput placeholder="Dr. Jane Doe" type="text" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground ml-1">Work Email</label>
                <GlowInput placeholder="jane@institute.edu" type="email" required />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  {isLogin && <Link href="/forgot-password" className="text-xs text-primary hover:text-accent transition-colors">Forgot password?</Link>}
                </div>
                <div className="relative">
                  <GlowInput 
                    placeholder="••••••••" 
                    type={showPassword ? "text" : "password"} 
                    required 
                    className="pr-12"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatedButton 
                variant="primary" 
                className="w-full h-12 mt-4" 
                type="submit" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </AnimatedButton>
            </form>

            {/* Toggle */}
            <div className="mt-8 text-center">
              <p className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="font-medium text-primary hover:text-accent transition-colors ml-2 focus:outline-none"
                >
                  {isLogin ? "Sign Up" : "Log In"}
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
