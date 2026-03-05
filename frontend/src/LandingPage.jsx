import { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import logoUrl from './assets/logo.png';
import {
    Sparkles, ChevronRight, UploadCloud, MessageSquare,
    Share2, Smartphone, Layers, Zap, Users,
    Monitor, Brain, ArrowRight, FileText, Globe, Code2,
    Shield, Rocket, Star, CheckCircle2, History
} from 'lucide-react';

/* ── PARTICLE FIELD ── */
function ParticleField() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const setSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        setSize();

        const particles = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.6 + 0.1,
            color: ['108,99,255', '0,229,196', '167,139,250', '56,189,248'][Math.floor(Math.random() * 4)],
        }));

        let raf;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
                ctx.fill();
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
            });
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                    if (dist < 140) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(108,99,255,${0.07 * (1 - dist / 140)})`;
                        ctx.lineWidth = 0.6;
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
            raf = requestAnimationFrame(draw);
        };
        draw();
        window.addEventListener('resize', setSize);
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setSize); };
    }, []);
    return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none', opacity: 0.9 }} />;
}

/* ── ANIMATED COUNTER ── */
function AnimCounter({ target, suffix = '' }) {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    const started = useRef(false);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && !started.current) {
                started.current = true;
                const num = parseInt(target);
                let cur = 0;
                const step = () => { cur = Math.min(cur + Math.ceil(num / 40), num); setVal(cur); if (cur < num) requestAnimationFrame(step); };
                requestAnimationFrame(step);
            }
        }, { threshold: 0.3 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [target]);
    return <span ref={ref}>{isNaN(parseInt(target)) ? target : val}{suffix}</span>;
}

/* ── GLOW WORD CYCLE ── */
function GlowWord({ words }) {
    const [idx, setIdx] = useState(0);
    const palettes = [
        { text: '#A5AFFF', glow: 'rgba(108,99,255,0.28)', bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)' },
        { text: '#B5BAFF', glow: 'rgba(108,99,255,0.28)', bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)' },
        { text: '#9B9EFF', glow: 'rgba(108,99,255,0.28)', bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)' },
        { text: '#C1C6FF', glow: 'rgba(108,99,255,0.28)', bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)' },
        { text: '#A0AAFF', glow: 'rgba(108,99,255,0.28)', bg: 'rgba(108,99,255,0.12)', border: 'rgba(108,99,255,0.35)' },
    ];

    useEffect(() => {
        const t = setInterval(() => setIdx(i => (i + 1) % words.length), 2600);
        return () => clearInterval(t);
    }, [words.length]);

    const p = palettes[idx % palettes.length];

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={idx}
                initial={{ opacity: 0, scale: 0.82, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    display: 'inline-block',
                    color: p.text,
                    background: p.bg,
                    border: `1.5px solid ${p.border}`,
                    borderRadius: '16px',
                    padding: '0 22px 4px',
                    marginLeft: '8px',
                    boxShadow: `0 0 40px ${p.glow}, 0 0 80px ${p.glow}`,
                    position: 'relative',
                    whiteSpace: 'nowrap',
                }}
            >
                {/* shimmer sweep */}
                <motion.span
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', delay: 0.3 }}
                    style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(90deg, transparent 0%, ${p.glow} 50%, transparent 100%)`,
                        borderRadius: '16px', pointerEvents: 'none',
                    }}
                />
                {words[idx]}
            </motion.span>
        </AnimatePresence>
    );
}

/* ── FLOATING ORB ── */
function FloatingOrb({ color, size, top, left, delay }) {
    return (
        <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 7 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
            style={{ position: 'fixed', top, left, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }}
        />
    );
}

/* ── FEATURE CARD (grid style) ── */
function FeatureCard({ icon: Icon, title, desc, accent, badge, delay }) {
    const [hovered, setHovered] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            style={{ position: 'relative' }}
        >
            {/* Animated border glow */}
            <motion.div
                animate={hovered ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: 'absolute', inset: '-1.5px', borderRadius: '25px',
                    background: `linear-gradient(135deg, ${accent}, transparent 60%, ${accent}66)`,
                    zIndex: 0,
                }}
            />
            <motion.div
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 280, damping: 20 }}
                style={{
                    position: 'relative', zIndex: 1,
                    display: 'flex', flexDirection: 'column', gap: '20px',
                    background: 'rgba(11, 11, 20, 0.9)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '24px', padding: '36px 32px',
                    backdropFilter: 'blur(30px)',
                    boxShadow: hovered ? `0 24px 70px rgba(0,0,0,0.6), 0 0 60px ${accent}20` : '0 8px 32px rgba(0,0,0,0.35)',
                    transition: 'box-shadow 0.3s ease', height: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* Sweep glow */}
                <motion.div
                    animate={hovered ? { x: '200%', opacity: [0, 0.2, 0] } : { x: '-100%', opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    style={{
                        position: 'absolute', top: 0, left: 0, width: '70%', height: '100%',
                        background: `linear-gradient(90deg, transparent, ${accent}28, transparent)`,
                        pointerEvents: 'none', zIndex: 2,
                    }}
                />
                {/* Corner glow */}
                <div style={{
                    position: 'absolute', top: '-30%', right: '-10%', width: '200px', height: '200px',
                    borderRadius: '50%', background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
                    pointerEvents: 'none', opacity: hovered ? 1 : 0.5, transition: 'opacity 0.4s',
                }} />

                {/* Icon */}
                <motion.div
                    animate={hovered ? { scale: 1.1, rotate: [0, -5, 5, 0] } : { scale: 1, rotate: 0 }}
                    transition={{ duration: 0.4 }}
                    style={{
                        width: '64px', height: '64px', borderRadius: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${accent}18`, border: `1.5px solid ${accent}35`,
                        boxShadow: hovered ? `0 0 30px ${accent}40` : `0 4px 16px rgba(0,0,0,0.3)`,
                        transition: 'box-shadow 0.3s', flexShrink: 0, zIndex: 3,
                    }}
                >
                    <Icon size={28} color={accent} strokeWidth={1.7} />
                </motion.div>

                <div style={{ zIndex: 3 }}>
                    {badge && (
                        <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: '100px',
                            background: `${accent}20`, color: accent, fontSize: '0.72rem',
                            fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px',
                            border: `1px solid ${accent}30`, textTransform: 'uppercase',
                        }}>{badge}</span>
                    )}
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#EEF0FF', margin: '0 0 10px', letterSpacing: '-0.01em' }}>
                        {title}
                    </h3>
                    <p style={{ color: 'rgba(184,188,216,0.7)', fontSize: '0.91rem', lineHeight: 1.7, margin: 0 }}>
                        {desc}
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}

/* ── HOW IT WORKS STEP ── */
function StepCard({ number, title, desc, accent, icon: Icon, delay }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}
        >
            <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                style={{
                    width: '88px', height: '88px', borderRadius: '50%',
                    background: `radial-gradient(circle, ${accent}30, ${accent}08)`,
                    border: `2px solid ${accent}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative', boxShadow: `0 0 40px ${accent}20`,
                }}
            >
                <Icon size={34} color={accent} strokeWidth={1.6} />
                <div style={{
                    position: 'absolute', top: '-8px', right: '-8px',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 800, color: '#000',
                }}>{number}</div>
            </motion.div>
            <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#EEF0FF', margin: '0 0 10px' }}>{title}</h3>
                <p style={{ color: 'rgba(184,188,216,0.65)', fontSize: '0.9rem', lineHeight: 1.65, margin: 0, maxWidth: '240px' }}>{desc}</p>
            </div>
        </motion.div>
    );
}

/* ── MAIN ── */
export default function LandingPage({ onLoginClick, onEnterApp }) {
    const { scrollY } = useScroll();
    const heroY = useTransform(scrollY, [0, 600], [0, -40]);
    // No opacity fade - hero stays readable while scrolling

    const features = [
        { icon: UploadCloud, title: 'Drag & Drop Upload', accent: '#6C63FF', badge: 'Smart UX', desc: 'Upload any file format — PDF, DOCX, XLSX, CSV, code files, images. Or paste a URL and let OMNIDOC fetch it immediately.' },
        { icon: Brain, title: 'AI-Powered Analysis', accent: '#00E5C4', badge: 'Hybrid RAG', desc: 'Dense + sparse retrieval with reranking and streaming. Ask questions and get precise, cited answers across your documents.' },
        { icon: Layers, title: 'Studio — Create', accent: '#A78BFA', badge: '9+ formats', desc: 'Turn documents into Audio Scripts, Slide Decks, Mind Maps, Quizzes, Flashcards, Infographics, Reports, and Data Tables.' },
        { icon: MessageSquare, title: 'Chat Across Docs', accent: '#38BDF8', badge: 'Multi-Doc', desc: 'Select multiple documents and run a unified AI chat session. Ask questions that span your entire document library at once.' },
        { icon: Share2, title: 'Share & Collaborate', accent: '#FB923C', badge: 'Public Links', desc: 'Generate public shareable links for any analysis. Share your AI-powered insights with colleagues or embed them anywhere.' },
        { icon: History, title: 'Document History', accent: '#34D399', badge: 'History', desc: 'Every analysis is saved automatically. Revisit past sessions, restore previous conversations, and pick up exactly where you left off.' },
    ];

    const howItWorks = [
        { number: 1, icon: UploadCloud, title: 'Upload Your Docs', accent: '#6C63FF', desc: 'Drag & drop PDFs, paste URLs, or type a search query to pull content instantly.' },
        { number: 2, icon: Brain, title: 'AI Analyses Everything', accent: '#00E5C4', desc: 'Our hybrid RAG engine processes and indexes your content in seconds.' },
        { number: 3, icon: MessageSquare, title: 'Chat & Create', accent: '#A78BFA', desc: 'Ask questions, generate studio content, and share insights — all in one place.' },
    ];

    const perks = [
        'No credit card required', '4 free analyses included', 'Instant setup, no install',
        '10+ file types supported', '100% private & secure', '9+ studio output formats',
    ];

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', position: 'relative', overflowX: 'hidden' }}>
            <style>{`
                @keyframes blink { 50% { opacity: 0; } }
                @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .hero-badge-shimmer {
                    background: linear-gradient(90deg, rgba(108,99,255,0.1), rgba(0,229,196,0.15), rgba(108,99,255,0.1));
                    background-size: 200% 100%;
                    animation: shimmer 3s linear infinite;
                }
                .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; }
                @media (max-width: 900px) { .feature-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 580px) { .feature-grid { grid-template-columns: 1fr; } }
                .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
                @media (max-width: 700px) { .steps-grid { grid-template-columns: 1fr; } }
                
                /* Responsive Utilities */
                .lp-nav { padding: 20px 56px; }
                .lp-hero { padding: 110px 24px 80px; }
                .lp-section { padding: 40px 56px 100px; }
                .lp-steps { padding: 80px 56px 100px; }
                .lp-pricing { padding: 80px 56px 100px; }
                
                @media (max-width: 768px) {
                    .lp-nav { padding: 16px 20px; flex-direction: column; gap: 16px; }
                    .lp-hero { padding: 80px 20px 40px; }
                    .lp-section { padding: 40px 24px 60px; }
                    .lp-steps { padding: 60px 24px 60px; }
                    .lp-pricing { padding: 60px 24px 60px; }
                    .lp-headline { font-size: clamp(2.5rem, 9vw, 3.5rem) !important; margin: 0 auto 10px !important; }
                }
            `}</style>

            <ParticleField />

            {/* Orbs */}
            <FloatingOrb color="rgba(108,99,255,0.22)" size="700px" top="-15%" left="-10%" delay={0} />
            <FloatingOrb color="rgba(0,229,196,0.14)" size="600px" top="45%" left="65%" delay={2} />
            <FloatingOrb color="rgba(167,139,250,0.12)" size="500px" top="85%" left="5%" delay={4} />
            <FloatingOrb color="rgba(56,189,248,0.10)" size="400px" top="30%" left="40%" delay={3} />

            {/* ── NAVBAR ── */}
            <motion.nav
                initial={{ y: -70, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                className="lp-nav"
                style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                    position: 'sticky', top: 0, zIndex: 100, background: 'rgba(4,4,10,0.84)',
                }}
            >
                <motion.div whileHover={{ scale: 1.04 }} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ display: 'flex', alignItems: 'center' }}
                    >
                        <img src={logoUrl} alt="Omnidoc Logo" style={{ width: '42px', height: '42px', objectFit: 'contain' }} />
                    </motion.div>
                    <span style={{
                        background: 'linear-gradient(135deg, #6C63FF, #00E5C4)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em',
                    }}>OMNIDOC AI</span>
                </motion.div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                        onClick={onEnterApp} className="btn btn-outline"
                        style={{ padding: '10px 26px', borderRadius: '100px', fontSize: '0.95rem' }}>
                        Enter App
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 36px rgba(108,99,255,0.6)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={onLoginClick} className="btn btn-primary"
                        style={{ borderRadius: '100px', fontSize: '0.95rem' }}>
                        Sign In
                    </motion.button>
                </div>
            </motion.nav>

            {/* ── HERO ── */}
            <motion.div style={{ y: heroY }} initial={false}>
                <div className="lp-hero" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', textAlign: 'center',
                    position: 'relative', zIndex: 1,
                }}>
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -20, scale: 0.85 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.65, delay: 0.1 }}
                    >
                        <motion.div
                            animate={{ borderColor: ['rgba(108,99,255,0.4)', 'rgba(0,229,196,0.5)', 'rgba(108,99,255,0.4)'] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="hero-badge-shimmer"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '10px',
                                padding: '10px 24px', borderRadius: '100px',
                                color: '#B8BFFF', fontWeight: 600,
                                marginBottom: '36px', border: '1px solid rgba(108,99,255,0.35)',
                                fontSize: '0.93rem', letterSpacing: '0.01em',
                            }}
                        >
                            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}>
                                <Sparkles size={15} color="#6C63FF" />
                            </motion.div>
                            The Ultimate AI Document Intelligence Platform
                            <span style={{ background: 'rgba(0,229,196,0.2)', color: '#00E5C4', fontSize: '0.75rem', padding: '2px 10px', borderRadius: '100px', fontWeight: 700 }}>NEW</span>
                        </motion.div>
                    </motion.div>

                    {/* Headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="lp-headline"
                        style={{
                            fontSize: 'clamp(3rem, 7vw, 6.5rem)',
                            fontWeight: 900, lineHeight: 1.05, maxWidth: '950px',
                            margin: '0 auto 6px', letterSpacing: '-0.045em', color: '#EEF0FF',
                        }}
                    >
                        Turn Any Document
                    </motion.h1>
                    <motion.h1
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        className="lp-headline"
                        style={{
                            fontSize: 'clamp(3rem, 7vw, 6.5rem)',
                            fontWeight: 900, lineHeight: 1.05, maxWidth: '950px',
                            margin: '0 auto 10px', letterSpacing: '-0.045em',
                        }}
                    >
                        into an
                    </motion.h1>
                    <motion.h1
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
                        className="lp-headline"
                        style={{
                            fontSize: 'clamp(3rem, 7vw, 6.5rem)',
                            fontWeight: 900, lineHeight: 1.05, maxWidth: '950px',
                            margin: '0 auto 36px', letterSpacing: '-0.045em',
                            minHeight: '1.1em',
                        }}
                    >
                        <GlowWord words={['AI Expert', 'Knowledge Base', 'Smart Assistant', 'Deep Insight', 'Studio Engine']} />
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.65, delay: 0.54 }}
                        style={{
                            fontSize: '1.22rem', color: 'rgba(184,188,216,0.78)',
                            maxWidth: '600px', margin: '0 auto 48px', lineHeight: 1.7,
                        }}
                    >
                        Upload PDFs, code, spreadsheets, or paste a URL. Get summaries, studio content — and chat with your data using powerful AI.
                    </motion.p>

                    {/* CTA buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, delay: 0.64 }}
                        style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '16px' }}
                    >
                        <motion.button
                            whileHover={{ scale: 1.07, boxShadow: '0 0 60px rgba(108,99,255,0.65), 0 12px 32px rgba(0,0,0,0.45)' }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onEnterApp}
                            className="btn btn-primary"
                            style={{ padding: '18px 44px', fontSize: '1.08rem', borderRadius: '100px', gap: '12px', display: 'flex', alignItems: 'center' }}
                        >
                            <span>Get Started Free</span>
                            <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
                                <ArrowRight size={18} />
                            </motion.div>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.07)' }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onLoginClick}
                            className="btn btn-outline"
                            style={{ padding: '18px 44px', fontSize: '1.08rem', borderRadius: '100px' }}
                        >Sign In</motion.button>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.85 }}
                        style={{ color: 'rgba(107,111,142,0.75)', fontSize: '0.85rem', marginBottom: '64px' }}
                    >
                        No credit card · Up to 4 free analyses · Instant access
                    </motion.div>

                    {/* Stats bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.75, delay: 0.78 }}
                        style={{
                            display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
                            background: 'rgba(12, 12, 22, 0.8)',
                            borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)',
                            backdropFilter: 'blur(24px)', overflow: 'hidden',
                        }}
                    >
                        {[
                            { value: '9', suffix: '+', label: 'Studio Formats', color: 'linear-gradient(135deg,#6C63FF,#A78BFA)' },
                            { value: '10', suffix: '+', label: 'File Types', color: 'linear-gradient(135deg,#00E5C4,#38BDF8)' },
                            { value: '4', suffix: 'x', label: 'Faster RAG', color: 'linear-gradient(135deg,#FB923C,#F59E0B)' },
                            { value: '100', suffix: '%', label: '100% Private', color: 'linear-gradient(135deg,#34D399,#22D3EE)' },
                        ].map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
                                {i > 0 && <div style={{ width: '1px', background: 'rgba(255,255,255,0.07)', margin: '14px 0' }} />}
                                <motion.div
                                    whileHover={{ background: 'rgba(255,255,255,0.04)' }}
                                    style={{ padding: '28px 44px', textAlign: 'center', transition: 'background 0.2s' }}
                                >
                                    <div style={{
                                        fontSize: '2.5rem', fontWeight: 900,
                                        background: s.color, WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent', backgroundClip: 'text', lineHeight: 1.1,
                                    }}>
                                        <AnimCounter target={s.value} suffix={s.suffix} />
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'rgba(107,111,142,0.9)', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
                                </motion.div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </motion.div>

            {/* ── FEATURES SECTION ── */}
            <div className="lp-section" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
                {/* Section header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.65 }}
                    style={{ textAlign: 'center', marginBottom: '64px' }}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '8px 20px', borderRadius: '100px',
                            background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)',
                            color: '#9D97FF', fontSize: '0.85rem', fontWeight: 600,
                            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px',
                        }}
                    >
                        <Star size={13} fill="#9D97FF" color="#9D97FF" /> Platform Features
                    </motion.div>

                    <h2 style={{
                        fontSize: 'clamp(2.2rem, 4.5vw, 4rem)',
                        fontWeight: 900, color: '#EEF0FF',
                        letterSpacing: '-0.04em', marginBottom: '16px', lineHeight: 1.1,
                    }}>
                        Everything You Need,<br />
                        <span style={{
                            background: 'linear-gradient(135deg, #6C63FF, #00E5C4)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                        }}>Nothing You Don't</span>
                    </h2>
                    <p style={{ color: 'rgba(107,111,142,0.85)', fontSize: '1.05rem', maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
                        Six powerful pillars that make OMNIDOC the most intelligent document AI platform available.
                    </p>
                </motion.div>

                {/* Feature grid */}
                <div className="feature-grid">
                    {features.map((f, i) => (
                        <FeatureCard key={i} {...f} delay={i * 0.07} />
                    ))}
                </div>
            </div>

            {/* ── HOW IT WORKS ── */}
            <div className="lp-steps" style={{
                position: 'relative', zIndex: 1,
                background: 'rgba(8,8,18,0.6)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.65 }}
                        style={{ textAlign: 'center', marginBottom: '72px' }}
                    >
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '8px 20px', borderRadius: '100px',
                            background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.2)',
                            color: '#00E5C4', fontSize: '0.85rem', fontWeight: 600,
                            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '24px',
                        }}>
                            <Rocket size={13} color="#00E5C4" /> How It Works
                        </div>
                        <h2 style={{
                            fontSize: 'clamp(2rem, 4vw, 3.5rem)',
                            fontWeight: 900, color: '#EEF0FF', letterSpacing: '-0.04em', marginBottom: '14px',
                        }}>
                            Up and Running in <span style={{ background: 'linear-gradient(135deg,#00E5C4,#38BDF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>60 Seconds</span>
                        </h2>
                        <p style={{ color: 'rgba(107,111,142,0.8)', fontSize: '1rem', maxWidth: '440px', margin: '0 auto', lineHeight: 1.65 }}>
                            Three simple steps to transform how you work with documents forever.
                        </p>
                    </motion.div>

                    {/* Connector line */}
                    <div style={{ position: 'relative' }}>
                        <div style={{
                            position: 'absolute', top: '44px', left: 'calc(16.67% + 44px)', right: 'calc(16.67% + 44px)',
                            height: '2px',
                            background: 'linear-gradient(90deg, rgba(108,99,255,0.4), rgba(0,229,196,0.4), rgba(167,139,250,0.4))',
                            zIndex: 0,
                        }} />
                        <div className="steps-grid" style={{ position: 'relative', zIndex: 1 }}>
                            {howItWorks.map((s, i) => <StepCard key={i} {...s} delay={i * 0.12} />)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PERKS STRIP ── */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="lp-section"
                style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}
            >
                <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px',
                }}>
                    {perks.map((perk, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.45, delay: i * 0.06 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px',
                                padding: '16px 22px', borderRadius: '16px',
                                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                            }}
                        >
                            <CheckCircle2 size={18} color="#00E5C4" strokeWidth={2} style={{ flexShrink: 0 }} />
                            <span style={{ color: 'rgba(184,188,216,0.82)', fontSize: '0.92rem', fontWeight: 500 }}>{perk}</span>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* ── CTA FOOTER ── */}
            <div className="lp-section">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7 }}
                    style={{
                        margin: '0 auto', maxWidth: '780px', width: '90%',
                        textAlign: 'center', padding: '10%',
                        position: 'relative', zIndex: 1, borderRadius: '32px',
                        overflow: 'hidden',
                        background: 'rgba(10, 10, 22, 0.9)',
                        border: '1px solid rgba(108,99,255,0.22)',
                        backdropFilter: 'blur(30px)',
                        boxShadow: '0 40px 120px rgba(0,0,0,0.5), 0 0 80px rgba(108,99,255,0.08)',
                    }}
                >
                    {/* Conic sweep */}
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                        style={{
                            position: 'absolute', inset: '-50%', width: '200%', height: '200%',
                            background: 'conic-gradient(from 0deg, transparent 0%, rgba(108,99,255,0.12) 25%, rgba(0,229,196,0.12) 50%, transparent 75%)',
                            zIndex: 0, borderRadius: '50%',
                        }}
                    />
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <motion.div
                            animate={{ y: [0, -8, 0], rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ fontSize: '3.5rem', marginBottom: '24px', display: 'block' }}
                        >🚀</motion.div>
                        <h2 style={{
                            fontSize: 'clamp(1.8rem, 3.5vw, 3rem)', fontWeight: 900, color: '#EEF0FF',
                            letterSpacing: '-0.04em', marginBottom: '16px', lineHeight: 1.15,
                        }}>
                            Ready to Transform<br />
                            <span style={{
                                background: 'linear-gradient(135deg,#6C63FF,#00E5C4)',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                            }}>Your Documents?</span>
                        </h2>
                        <p style={{ color: 'rgba(184,188,216,0.68)', marginBottom: '40px', lineHeight: 1.7, fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 40px' }}>
                            Join OMNIDOC AI and unlock intelligent document analysis, studio content creation, and real-time AI conversation — all for free.
                        </p>
                        <motion.button
                            whileHover={{ scale: 1.07, boxShadow: '0 0 60px rgba(108,99,255,0.65)' }}
                            whileTap={{ scale: 0.96 }}
                            onClick={onEnterApp} className="btn btn-primary"
                            style={{ padding: '18px 52px', fontSize: '1.08rem', borderRadius: '100px', display: 'inline-flex', alignItems: 'center', gap: '10px' }}
                        >
                            Start for Free <ChevronRight size={19} />
                        </motion.button>
                        <div style={{ marginTop: '20px', color: 'rgba(107,111,142,0.65)', fontSize: '0.85rem' }}>
                            No credit card · Instant access · 4 free analyses
                        </div>
                    </div>
                </motion.div>

                {/* Footer */}
                <div style={{ textAlign: 'center', padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', color: 'rgba(107,111,142,0.5)', fontSize: '0.82rem', position: 'relative', zIndex: 1 }}>
                    © 2026 OMNIDOC AI · Built with AI intelligence
                </div>
            </div>
        </div>
    );
}
