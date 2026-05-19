"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, Variants } from "framer-motion";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { PlayCircle, Shield, Podcast, Network, Bot, FileText, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);
  
  const heroY = useTransform(scrollY, [0, 500], [0, 150]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30 selection:text-primary">
      
      {/* Dynamic Header */}
      <motion.header
        className={cn(
          "fixed top-0 inset-x-0 z-50 h-20 transition-all duration-300 flex items-center px-8",
          isScrolled ? "bg-surface/60 backdrop-blur-xl border-b border-white/10" : "bg-transparent"
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex-1">
          <Link href="/">
            <span className="font-display text-2xl font-bold tracking-tight">OpenNotebook</span>
            <span className="font-display text-2xl font-light text-primary"> AI</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="#about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</a>
        </nav>
        <div className="flex-1 flex justify-end">
          <Link href="/login">
            <AnimatedButton variant="primary" size="sm" className="rounded-full px-6">
              Sign In
            </AnimatedButton>
          </Link>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="relative min-h-[100svh] flex items-center justify-center pt-20">
        {/* Background Gradients */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-[10%] -left-[10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[120px]" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute top-[20%] -right-[10%] w-[60vw] h-[60vw] bg-accent/15 rounded-full blur-[150px]" 
          />
        </div>

        <motion.div 
          className="container mx-auto px-4 relative z-10 text-center flex flex-col items-center"
          style={{ y: heroY, opacity: heroOpacity }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-xs font-mono text-accent uppercase tracking-wider">OpenNotebook OS v2.0 Live</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight max-w-5xl leading-[1.1] mb-6">
            Think Faster.<br />
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              Synthesize Deeper.
            </span>
          </motion.h1>

          <motion.p variants={itemVariants} className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            The premium AI co-processor for research teams. Upload thousands of documents, generate knowledge graphs instantly, and extract insights with zero-hallucination guarantees.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center">
            <Link href="/login">
              <AnimatedButton variant="primary" size="lg" className="w-full sm:w-auto min-w-[200px]">
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </AnimatedButton>
            </Link>
            <AnimatedButton variant="outline" size="lg" className="w-full sm:w-auto min-w-[200px]">
              <PlayCircle className="w-5 h-5 mr-2" />
              Watch Demo
            </AnimatedButton>
          </motion.div>
        </motion.div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="relative z-20 -mt-20 pb-32">
        <motion.div 
          initial={{ opacity: 0, y: 100 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, type: "spring", bounce: 0.3 }}
          className="container mx-auto px-4"
        >
          <div className="relative rounded-[32px] p-2 bg-gradient-to-b from-white/10 to-transparent shadow-[0_0_80px_rgba(192,193,255,0.1)]">
            <div className="rounded-[24px] overflow-hidden border border-white/10 bg-[#060a14] relative aspect-[16/9] lg:aspect-[21/9]">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAKK1XvrmAzCY5XRISMqNFe3_nKUntb9O0LARDXSOQuABQl-NqDlWVT-Xbwa3vnrYFaC4yBVJt2_sRRwH-oj_r-82kl-Rm5syJlP42kFaoU-C3fePCDP93hvMOt6uALanWvJLI64l-dEiC-upWMhYSJXnrvNp11PvEWqOa3XCMd4IldP5j5wZJwHHLJ9JOTz6VQuavGOGrQmyblBQfieEWklMzjpKX2Ypvrp-Qg-Is7Rs-utyV96nL7MwaLqgYBVmBW9fjJ4BjrmerH" 
                alt="OpenNotebook Interface" 
                className="w-full h-full object-cover opacity-80"
              />
              
              {/* Floating Element */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-6 -bottom-6 md:right-8 md:bottom-8 glass p-4 rounded-2xl flex items-center gap-4 border border-primary/20"
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Insight Synthesized</p>
                  <p className="text-xs text-muted-foreground">Found correlation in 14 docs</p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Logos */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground mb-8">Trusted by frontier teams</p>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-50 grayscale">
            <span className="font-display text-2xl font-bold tracking-tight">OXYGEN Labs</span>
            <span className="font-display text-2xl font-bold tracking-tight">NEXUS</span>
            <span className="font-display text-2xl font-bold tracking-tight">QuantumTech</span>
            <span className="font-display text-2xl font-bold tracking-tight">VERTEX</span>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 relative">
        <div className="container mx-auto px-4">
          <div className="mb-20 max-w-3xl">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">Built for the cognitive demands of tomorrow.</h2>
            <p className="text-xl text-muted-foreground">A unified suite of specialized AI tools that function as a single, coherent research ecosystem.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 - Large */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:col-span-2 relative group rounded-[32px] overflow-hidden"
            >
              <GlassCard className="h-full min-h-[400px] flex flex-col justify-between" glowColor="primary">
                <div className="relative z-10 w-full md:w-2/3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Network className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display text-3xl font-bold mb-4">Knowledge Graph Intelligence</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Automatically map relationships between thousands of documents, identifying non-obvious connections and structural gaps in your research.
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 w-2/3 h-full pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/50 to-transparent z-10"></div>
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0YYFyPUFW70fUIWAUdTSTgaNO89q2aDyXq1Xl1lPNxGCgx43mLvL48tf4w1fvV-FYJ7Hsf08upA8r5_F4wqzS9hlCK_lsoNo-fQa58slZbDoxgUxG0Hq20g8Hq65cMwsjz_85yTzYWB_sBqnYvZE-Y4QpyWKkGiPGfwqjTziRE1FIAEtlfvTZ6sckgY9znQ-1AQAFoaNfTRJknVBm4iOuHsSzZz9cYVU14ZK2oGtMeDqsHhGZNxAcotiwwtwvGlmazhoHLPj2m5rZ"
                    alt="Knowledge Graph"
                    className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-700 mix-blend-screen"
                  />
                </div>
              </GlassCard>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <GlassCard className="h-full min-h-[400px] flex flex-col" glowColor="secondary">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mb-6">
                  <Podcast className="w-7 h-7 text-secondary" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-4">AI Podcast Studio</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Transform any collection of papers into a professional, narrated deep-dive podcast for on-the-go learning.
                </p>
              </GlassCard>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <GlassCard className="h-full min-h-[300px] flex flex-col" glowColor="accent">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
                  <Shield className="w-7 h-7 text-accent" />
                </div>
                <h3 className="font-display text-2xl font-bold mb-4">Secure Vault</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Enterprise-grade encryption and local-first storage options for your most sensitive data.
                </p>
              </GlassCard>
            </motion.div>

            {/* Feature 4 - Large */}
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2"
            >
              <GlassCard className="h-full min-h-[300px] flex flex-col md:flex-row items-center gap-8" hoverEffect={false}>
                <div className="flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <FileText className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-display text-3xl font-bold mb-4">Document Intelligence</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Ingest PDFs, LaTeX, and datasets. Our engine reads with 99.9% accuracy, understanding charts, footnotes, and complex citations.
                  </p>
                </div>
                <div className="flex-1 flex justify-center items-center relative w-full h-[200px]">
                  <motion.div 
                    animate={{ y: [-10, 10, -10], rotate: [-2, 2, -2] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute bg-surface-hover w-48 h-64 rounded-xl border border-white/10 shadow-2xl z-10 p-4"
                  >
                    <div className="w-full h-4 bg-white/5 rounded-full mb-4"></div>
                    <div className="w-3/4 h-4 bg-white/5 rounded-full mb-2"></div>
                    <div className="w-5/6 h-4 bg-white/5 rounded-full mb-8"></div>
                    <div className="w-full h-24 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-center">
                      <Bot className="text-primary w-8 h-8 opacity-50" />
                    </div>
                  </motion.div>
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-32 relative bg-surface">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">Plans that scale with you.</h2>
            <p className="text-xl text-muted-foreground">From solo researchers to global organizations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <GlassCard className="flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-display font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> 3 Notebooks</li>
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Basic AI Summaries</li>
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Community Support</li>
              </ul>
              <AnimatedButton variant="outline" className="w-full">Start Free</AnimatedButton>
            </GlassCard>

            {/* Pro Plan */}
            <motion.div whileHover={{ y: -10 }} className="relative z-10">
              <div className="absolute -inset-[1px] rounded-[33px] bg-gradient-to-b from-primary via-accent to-secondary opacity-50 blur-[2px]"></div>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-[#0b1326] px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider z-20">Most Popular</div>
              <GlassCard className="relative flex flex-col h-full bg-[#11192b] border-transparent" hoverEffect={false}>
                <h3 className="text-2xl font-bold mb-2">Pro</h3>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-5xl font-display font-bold">$29</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Unlimited Notebooks</li>
                  <li className="flex items-center gap-3 text-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Podcast Studio Access</li>
                  <li className="flex items-center gap-3 text-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Multi-Agent Research</li>
                  <li className="flex items-center gap-3 text-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Priority API Access</li>
                </ul>
                <AnimatedButton variant="primary" className="w-full">Start Pro Trial</AnimatedButton>
              </GlassCard>
            </motion.div>

            {/* Enterprise Plan */}
            <GlassCard className="flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-5xl font-display font-bold">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Private Cloud Deploy</li>
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Custom Fine-tuning</li>
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> SSO & Audit Logs</li>
                <li className="flex items-center gap-3 text-muted-foreground"><CheckCircle2 className="w-5 h-5 text-primary" /> Dedicated Support</li>
              </ul>
              <AnimatedButton variant="outline" className="w-full">Contact Sales</AnimatedButton>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <h2 className="font-display text-4xl md:text-6xl font-bold mb-6">Amplify your intelligence.</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">Join the thousands of researchers building the future with OpenNotebook.</p>
          <Link href="/login">
            <AnimatedButton variant="primary" size="lg" className="px-12 text-lg">
              Get Started Now
            </AnimatedButton>
          </Link>
        </div>
      </section>
    </div>
  );
}
