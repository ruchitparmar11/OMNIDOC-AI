import { useState, useRef, useEffect } from 'react';
import { Bot, FileText, UploadCloud, MessageSquare, Clock, LogOut, Send, Sparkles, Menu, Trash2, Copy, Check, Download, List, Search, HelpCircle, Volume2, VolumeX, Share2, CreditCard, Settings, Star, X, Mic, Monitor, Video, Network, Layers, BarChart, Table, Columns } from 'lucide-react';
import LandingPage from './LandingPage';
import AdminPanel from './AdminPanel';
import SharedDocument from './SharedDocument';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import html2pdf from 'html2pdf.js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { motion, AnimatePresence } from 'framer-motion';
import logoUrl from './assets/logo.png';

const rawApiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const API_BASE = rawApiBase.endsWith('/api') ? rawApiBase : `${rawApiBase}/api`;
const MOBILE_BREAKPOINT = 900;

const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div style={{ position: 'relative', margin: '1em 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2d2d2d', padding: '8px 12px', fontSize: '0.8rem', color: '#ccc' }}>
          <span>{match[1]}</span>
          <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
            {isCopied ? <><Check size={14} color="var(--primary)" /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, borderRadius: 0, background: '#1e1e1e' }}
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className={className} {...props} style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 4px', borderRadius: '4px', fontSize: '0.9em' }}>
      {children}
    </code>
  );
};

const TypewriterText = ({ text, delay = 10 }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
  }, [text]);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(v => v + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{displayedText}</ReactMarkdown>;
};

const SkeletonLoader = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', padding: '8px 0' }}>
    <div className="skeleton-line" style={{ width: '90%', height: '16px', borderRadius: '4px' }}></div>
    <div className="skeleton-line" style={{ width: '100%', height: '16px', borderRadius: '4px' }}></div>
    <div className="skeleton-line" style={{ width: '80%', height: '16px', borderRadius: '4px' }}></div>
    <div className="skeleton-line" style={{ width: '60%', height: '16px', borderRadius: '4px' }}></div>
  </div>
);

const TextToSpeechButton = ({ text }) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <button onClick={toggleSpeech} className={isSpeaking ? "btn btn-primary" : "btn btn-outline"} style={{ padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', width: 'fit-content' }} title="Read Aloud">
      {isSpeaking ? <><VolumeX size={16} /> Stop</> : <><Volume2 size={16} /> Listen</>}
    </button>
  );
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('omnidoc_user');
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('omnidoc_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeTab, setActiveTab] = useState('upload'); // 'upload', 'deepdive', or 'admin'
  const [outputType, setOutputType] = useState('Summary');
  const [historyOpen, setHistoryOpen] = useState(true);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState([]);

  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [studioCollapsed, setStudioCollapsed] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState('login');
  const [showLanding, setShowLanding] = useState(!localStorage.getItem('omnidoc_user'));
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [sharedId, setSharedId] = useState(null);

  const [historyWidth, setHistoryWidth] = useState(300);
  const [studioWidth, setStudioWidth] = useState(450);
  const [isResizingHistory, setIsResizingHistory] = useState(false);
  const [isResizingStudio, setIsResizingStudio] = useState(false);

  const [mobileTab, setMobileTab] = useState('chat'); // 'history', 'chat', 'studio'
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingHistory) {
        setHistoryWidth(Math.max(200, Math.min(600, e.clientX)));
      }
      if (isResizingStudio) {
        setStudioWidth(Math.max(300, Math.min(800, window.innerWidth - e.clientX)));
      }
    };

    const handleMouseUp = () => {
      setIsResizingHistory(false);
      setIsResizingStudio(false);
    };

    if (isResizingHistory || isResizingStudio) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.userSelect = 'auto';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'auto';
    };
  }, [isResizingHistory, isResizingStudio]);

  useEffect(() => {
    const onResize = () => {
      setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    // Keep mobile panes expanded so each tab view remains consistent.
    setHistoryOpen(true);
    setStudioCollapsed(false);
  }, [isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (activeTab === 'upload' || activeTab === 'deepdive') {
      setMobileTab('chat');
    }
  }, [activeTab, isMobileViewport]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('share');
    if (sId) setSharedId(sId);

    const success = params.get('success');
    const uId = params.get('user_id');
    const canceled = params.get('canceled');

    if (success && uId) {
      axios.post(`${API_BASE}/user/checkout-success`, { user_id: uId }).then(res => {
        if (res.data.success) {
          toast.success("Payment Successful! Welcome to Premium.");
          const saved = JSON.parse(localStorage.getItem('omnidoc_user') || '{}');
          if (saved && saved.id) {
            saved.is_premium = true;
            setCurrentUser(saved);
            localStorage.setItem('omnidoc_user', JSON.stringify(saved));
          }
        }
      });
      window.history.replaceState(null, '', window.location.pathname);
    }

    if (canceled) {
      toast.warning("Payment canceled.");
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // File upload state
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingStudio, setIsAnalyzingStudio] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [folderInput, setFolderInput] = useState("Recent");
  const [documentResults, setDocumentResults] = useState(null);
  const [studioResult, setStudioResult] = useState(null);
  const [activeStudioTool, setActiveStudioTool] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (activeTab === 'deepdive' && (chatHistory.length > 0 || isSending)) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [chatHistory, isSending, activeTab]);

  // Authentication callbacks
  const [historyList, setHistoryList] = useState([]);

  const fetchHistory = async () => {
    if (currentUser) {
      try {
        const res = await axios.get(`${API_BASE}/history/${currentUser.id}`);
        if (res.data.success) {
          setHistoryList(res.data.history);
        }
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser]);

  const loadHistoryItem = (item) => {
    setActiveTab('deepdive');
    if (isMobileViewport) setMobileTab('chat');
    setShowDocumentViewer(false);
    setIsLoadingHistory(true);
    setDocumentResults(null);
    setStudioResult(null);
    setActiveStudioTool(null);
    setChatHistory([]);
    setTextInput("");
    setSelectedFile(null);
    setMultiSelectMode(false);
    setSelectedHistoryIds([]);

    // Simulate retrieval to show the skeleton loader for UX
    setTimeout(() => {
      setDocumentResults({
        id: item.id,
        description: item.description,
        questions: item.questions ? item.questions.split('\n') : [],
        fileName: item.file_name,
        content: item.content
      });

      let parsedChats = [];
      let latestStudio = null;
      let latestStudioToolId = null;
      if (item.answers) {
        try {
          const allAnswers = JSON.parse(item.answers);
          parsedChats = allAnswers.filter(a => a.role !== 'studio');
          const studioAnswers = allAnswers.filter(a => a.role === 'studio');
          if (studioAnswers.length > 0) {
            const lastStudio = studioAnswers[studioAnswers.length - 1];
            latestStudio = lastStudio.content;
            latestStudioToolId = lastStudio.feature;
          }
        } catch (e) {
          console.error("Failed to parse chat history");
        }
      }
      setChatHistory(parsedChats);

      if (latestStudio) {
        setStudioResult(latestStudio);
        const tools = [
          { id: 'audio', label: 'Audio Overview', icon: <Volume2 size={20} /> },
          { id: 'slide', label: 'Slide deck', icon: <Monitor size={20} /> },
          { id: 'video', label: 'Video Overview', icon: <Video size={20} /> },
          { id: 'mindmap', label: 'Mind Map', icon: <Network size={20} /> },
          { id: 'reports', label: 'Reports', icon: <FileText size={20} /> },
          { id: 'flashcards', label: 'Flashcards', icon: <Layers size={20} /> },
          { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={20} /> },
          { id: 'infographic', label: 'Infographic', icon: <BarChart size={20} /> },
          { id: 'datatable', label: 'Data table', icon: <Table size={20} /> }
        ];
        const tool = tools.find(t => t.id === latestStudioToolId);
        if (tool) setActiveStudioTool(tool);
        setStudioCollapsed(false);
      }

      setIsLoadingHistory(false);
    }, 1000);
  };

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setShowAuth(false);
    setShowLanding(false);
    localStorage.setItem('omnidoc_user', JSON.stringify(user));
    if (token) localStorage.setItem('omnidoc_token', token);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setShowLanding(false);
    setInitialAuthMode('login');
    setShowAuth(true);
    localStorage.removeItem('omnidoc_user');
    localStorage.removeItem('omnidoc_token');
    toast.info("You've been logged out. See you soon! 👋");
  };

  const handleDeleteHistory = async (id) => {
    try {
      const res = await axios.delete(`${API_BASE}/history/${id}`);
      if (res.data.success) {
        setHistoryList(prev => prev.filter(item => item.id !== id));
        if (documentResults?.id === id) {
          setDocumentResults(null);
          setChatHistory([]);
          setActiveTab('upload');
        }
      }
    } catch (err) {
      console.error("Error deleting history:", err);
    }
  };

  const exportToPDF = () => {
    const element = document.getElementById('deep-dive-report');
    if (!element) return;

    // hide elements we don't want in PDF like interactive buttons
    const btns = element.querySelectorAll('button');
    btns.forEach(b => b.style.display = 'none');

    const opt = {
      margin: 10,
      filename: `OmniDoc_${documentResults.fileName || 'Report'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#1e1e20' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      // restore buttons
      btns.forEach(b => b.style.display = '');
    });
  };

  const handleAnalyze = async (overrideType = null, featObj = null) => {
    // Prevent React's SyntheticEvent from being used as the overrideType
    if (overrideType && typeof overrideType !== 'string') {
      overrideType = null;
    }

    if (!isAuthenticated) {
      toast.info("Please sign up or login to analyze files");
      setInitialAuthMode('signup');
      setShowAuth(true);
      return;
    }

    if (!selectedFile && !textInput.trim() && !documentResults) {
      toast.warning("Please upload a file or enter text");
      return;
    }

    if (overrideType && featObj) {
      setIsAnalyzingStudio(true);
      setActiveStudioTool(featObj);
      setStudioCollapsed(false);
      setStudioResult(null);
    } else {
      setIsAnalyzing(true);
    }

    try {
      const formData = new FormData();
      if (currentUser) formData.append('user_id', currentUser.id);
      if (selectedFile) formData.append('file', selectedFile);
      if (textInput) formData.append('text', textInput);
      formData.append('folder_name', folderInput);

      if (overrideType && featObj && !selectedFile && !textInput.trim() && documentResults && documentResults.content) {
        formData.append('text', documentResults.content);
        if (documentResults.id) formData.append('history_id', documentResults.id);
      }

      formData.append('output_type', typeof overrideType === 'string' ? overrideType : outputType);

      const res = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.success) {
        if (overrideType && featObj) {
          toast.success(`${featObj.label} Generated Successfully!`);
          setStudioResult(res.data.data.description);
        } else {
          toast.success("Document Analyzed Successfully!");
          setDocumentResults(res.data.data);
          if (currentUser && res.data.data.analysis_count !== undefined) {
            const updated = { ...currentUser, analysis_count: res.data.data.analysis_count };
            setCurrentUser(updated);
            localStorage.setItem('omnidoc_user', JSON.stringify(updated));
          }
          setChatHistory([]); // reset chat
          setActiveTab('deepdive');
          if (isMobileViewport) setMobileTab('chat');
          fetchHistory();
        }
      } else {
        toast.error("Verification Error: " + res.data.message);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setShowUpgradeModal(true);
      } else {
        toast.error("Error analyzing content: " + (err.response?.data?.message || err.message));
      }
    } finally {
      if (overrideType) setIsAnalyzingStudio(false);
      else setIsAnalyzing(false);
    }
  };

  const handleChatSubmit = async (overridePrompt) => {
    const textToSubmit = typeof overridePrompt === 'string' ? overridePrompt : chatInput;
    if (!textToSubmit.trim() || (!documentResults?.id && (!multiSelectMode || selectedHistoryIds.length === 0))) return;

    const historyIdsToSubmit = multiSelectMode && selectedHistoryIds.length > 0 ? selectedHistoryIds : [documentResults?.id];

    const userMsg = { role: 'user', content: textToSubmit.trim() };
    setChatHistory(prev => [...prev, userMsg, { role: 'ai', content: '' }]);
    setIsSending(true);
    setChatInput("");

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history_ids: historyIdsToSubmit,
          question: textToSubmit.trim()
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let aiContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr.trim() === '[DONE]') break;
            try {
              const dataObj = JSON.parse(dataStr);
              if (dataObj.content) {
                aiContent += dataObj.content;
                setChatHistory(prev => {
                  const newHistory = [...prev];
                  newHistory[newHistory.length - 1].content = aiContent;
                  return newHistory;
                });
              }
            } catch (e) { }
          }
        }
      }
    } catch (err) {
      toast.error("Failed to get answer: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleShare = async () => {
    try {
      const res = await axios.post(`${API_BASE}/share/${documentResults.id}`);
      if (res.data.success) {
        const url = `${window.location.origin}/?share=${res.data.shared_id}`;
        navigator.clipboard.writeText(url);
        toast.success("Share link created and copied to clipboard!");
      }
    } catch (err) {
      toast.error("Failed to generate share link.");
    }
  };

  const handleCheckout = async () => {
    try {
      const res = await axios.post(`${API_BASE}/create-checkout-session`, { user_id: currentUser.id });
      if (res.data.success && res.data.url) {
        window.location.href = res.data.url;
      } else {
        toast.error("Stripe Error: " + res.data.message);
      }
    } catch (err) {
      toast.error("Failed to start Stripe checkout.");
    }
  };

  if (sharedId) {
    return <SharedDocument sharedId={sharedId} onGoDashboard={() => { setSharedId(null); setShowLanding(false); setShowAuth(true); }} />
  }

  if (showLanding && !isAuthenticated) {
    return (
      <LandingPage
        onLoginClick={() => {
          setInitialAuthMode('login');
          setShowAuth(true);
          setShowLanding(false);
        }}
        onEnterApp={() => {
          setShowLanding(false);
          setShowAuth(false);
        }}
      />
    );
  }

  if (!isAuthenticated && showAuth) {
    return (
      <div style={{ paddingTop: '20px', minHeight: '100vh', background: 'var(--bg-main)' }}>
        <div style={{ padding: '20px', maxWidth: 800, margin: '0 auto' }}>
          <button className="btn btn-outline" onClick={() => { setShowAuth(false); if (!isAuthenticated) setShowLanding(true); }}>Back to home</button>
        </div>
        <AuthScreen onLogin={handleLoginSuccess} initialMode={initialAuthMode} key={initialAuthMode} />
      </div>
    );
  }

  if (activeTab === 'admin' && currentUser?.role === 'admin') {
    return (
      <div className="dashboard-layout animate-fade-in" style={{ display: 'block' }}>
        <AdminPanel onBack={() => setActiveTab('upload')} />
      </div>
    );
  }

  return (
    <div className={`app-wrapper mobile-tab-${mobileTab}`} style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Unified Mobile Header & Tabs */}
      <div className="mobile-header-area">
        <div className="mobile-unified-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={logoUrl} alt="logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
            <span className="text-gradient" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>OMNIDOC AI</span>
          </div>
          {isAuthenticated && (
            <button className="btn-icon-only" onClick={() => currentUser?.role === 'admin' ? setActiveTab('admin') : handleLogout()} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', padding: '4px' }}>
              {currentUser?.role === 'admin' ? <Settings size={20} /> : <LogOut size={20} />}
            </button>
          )}
        </div>
        <div className="mobile-tabs">
          <button className={`mobile-tab-btn ${mobileTab === 'history' ? 'active' : ''}`} onClick={() => setMobileTab('history')}>
            History
          </button>
          <button className={`mobile-tab-btn ${mobileTab === 'chat' ? 'active' : ''}`} onClick={() => setMobileTab('chat')}>
            Upload & Chat
          </button>
          <button className={`mobile-tab-btn ${mobileTab === 'studio' ? 'active' : ''}`} onClick={() => setMobileTab('studio')}>
            Studio
          </button>
        </div>
      </div>

      <div className="dashboard-layout animate-fade-in" style={{ flex: 1, minHeight: 0 }}>
        {/* Upgrade Modal overlay */}
        {showUpgradeModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel animate-fade-in" style={{ padding: '40px', maxWidth: '400px', textAlign: 'center' }}>
              <Star size={48} color="gold" style={{ marginBottom: '16px' }} />
              <h2 style={{ marginBottom: '16px' }}>Upgrade to Premium</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>You have reached your 4 free analyses limit. Upgrade to unlock unlimited processing, larger uploads, and faster extraction.</p>
              <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1.1rem', marginBottom: '16px' }} onClick={handleCheckout}>
                <CreditCard size={18} /> Continue to Stripe Checkout
              </button>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setShowUpgradeModal(false)}>Cancel</button>
            </div>
          </div>
        )}
        <ToastContainer theme="dark" position="bottom-right" />
        {/* Sidebar - History */}
        <aside className={`sidebar history-sidebar ${historyOpen ? '' : 'collapsed'}`} style={{ width: historyOpen ? `${historyWidth}px` : '80px', flexShrink: 0, transition: isResizingHistory ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: historyOpen ? 'space-between' : 'center' }}>
            {historyOpen && <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={20} className="text-gradient" /> History</h2>}
            <button className="btn-icon-only" style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => setHistoryOpen(!historyOpen)}>
              <Menu size={20} />
            </button>
          </div>

          <div className="sidebar-content" style={{ flex: 1 }}>
            {historyOpen && (
              <>
                <div className="history-meta" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📚 {historyList.length} recent sessions</span>
                  {historyList.length > 0 && (
                    <button className="btn-icon-only" style={{ padding: '4px', fontSize: '0.8rem', background: multiSelectMode ? 'var(--primary)' : 'transparent', color: multiSelectMode ? '#fff' : 'var(--text-muted)' }} onClick={() => { setMultiSelectMode(!multiSelectMode); setSelectedHistoryIds(multiSelectMode ? [] : (documentResults ? [documentResults.id] : [])); }} title="Multi-Document Chat">
                      <List size={14} /> Multi
                    </button>
                  )}
                </div>
                {multiSelectMode && selectedHistoryIds.length > 0 && (
                  <button className="btn btn-primary" style={{ width: '100%', marginBottom: '16px', padding: '8px', fontSize: '0.85rem' }} onClick={() => { setActiveTab('deepdive'); setDocumentResults(null); setChatHistory([]); }}>
                    Chat across {selectedHistoryIds.length} Docs
                  </button>
                )}
                {historyList.length === 0 && !isLoadingHistory && (
                  <div style={{
                    textAlign: 'center', padding: '32px 16px',
                    background: 'rgba(108,99,255,0.06)', borderRadius: '16px',
                    border: '1px dashed rgba(108,99,255,0.25)', marginTop: '8px'
                  }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📄</div>
                    <p style={{ color: 'var(--text-main)', fontWeight: 600, marginBottom: '6px', fontSize: '0.95rem' }}>No analyses yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>Upload your first document to get started. Your sessions will appear here.</p>
                  </div>
                )}
                {isLoadingHistory && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div className="skeleton-line" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
                        <div className="skeleton-line" style={{ width: '45%', height: '10px', borderRadius: '4px' }} />
                      </div>
                    ))}
                  </div>
                )}
                {Object.entries(
                  historyList.reduce((acc, item) => {
                    const folder = item.folder_name || 'Recent';
                    if (!acc[folder]) acc[folder] = [];
                    acc[folder].push(item);
                    return acc;
                  }, {})
                ).map(([folderName, items]) => (
                  <div key={folderName} style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', paddingLeft: '8px' }}>
                      📁 {folderName}
                    </div>
                    {items.map((item, idx) => {
                      const date = new Date(item.created_at).toLocaleDateString();
                      const isActive = documentResults?.id === item.id;
                      let studioFeatures = [];
                      if (item.answers) {
                        try {
                          const answers = typeof item.answers === 'string' ? JSON.parse(item.answers) : item.answers;
                          studioFeatures = answers.filter(a => a?.role === 'studio').map(a => a.feature);
                        } catch (e) {
                          console.error('Failed to parse item.answers', e);
                        }
                      }
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                        >
                          <HistoryItem
                            title={item.file_name || "Text Analysis"}
                            date={date}
                            type={item.content_type || "txt"}
                            active={isActive}
                            studioFeatures={studioFeatures}
                            onClick={() => {
                              if (multiSelectMode) {
                                setSelectedHistoryIds(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
                              } else {
                                loadHistoryItem(item);
                              }
                            }}
                            onDelete={() => handleDeleteHistory(item.id)}
                            onRename={(newName) => {
                              setHistoryList(prev => prev.map(h => h.id === item.id ? { ...h, file_name: newName } : h));
                              axios.patch(`${API_BASE}/history/${item.id}/rename`, { name: newName }).catch(() => { });
                            }}
                            multiSelectMode={multiSelectMode}
                            isSelected={selectedHistoryIds.includes(item.id)}
                          />
                        </motion.div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="sidebar-footer">
            {isAuthenticated ? (
              <button className={historyOpen ? "btn btn-outline" : "btn"} style={{ width: '100%', justifyContent: 'center', padding: historyOpen ? '12px 24px' : '12px 0', background: 'transparent', color: 'var(--text-main)' }} onClick={handleLogout}>
                <LogOut size={18} /> {historyOpen && 'Logout'}
              </button>
            ) : (
              <button className={historyOpen ? "btn btn-primary" : "btn"} style={{ width: '100%', justifyContent: 'center', padding: historyOpen ? '12px 24px' : '12px 0' }} onClick={() => { setShowAuth(true); setInitialAuthMode('login'); }}>
                <Bot size={18} /> {historyOpen && 'Sign In'}
              </button>
            )}
          </div>
        </aside>

        {historyOpen && <div className={`resize-handle ${isResizingHistory ? 'active' : ''}`} onMouseDown={() => setIsResizingHistory(true)}></div>}

        {/* Main Content */}
        <main className="main-content">
          <header className="desktop-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                <img src={logoUrl} alt="logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <h1 className="text-gradient" style={{ fontSize: '2.5rem', margin: 0 }}>OMNIDOC AI</h1>
              </div>
              <p style={{ color: 'var(--text-muted)' }}>
                {isAuthenticated
                  ? `Ready to explore your documents with AI-powered insights, ${currentUser?.username || 'User'}!`
                  : 'Welcome! Experience the power of AI document analysis.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {currentUser?.role === 'admin' ? (
                <button className="btn btn-outline" style={{ background: 'rgba(79, 70, 229, 0.1)', borderColor: 'rgba(79, 70, 229, 0.3)', padding: '6px 16px', borderRadius: '100px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }} onClick={() => setActiveTab('admin')}>
                  <Settings size={14} /> Admin Panel
                </button>
              ) : currentUser?.is_premium ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 215, 0, 0.1)', padding: '6px 16px', borderRadius: '100px', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                  <Star size={14} color="gold" />
                  <span style={{ fontSize: '0.9rem', color: 'gold', fontWeight: '500' }}>Premium Active</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 16px', borderRadius: '100px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <span style={{ fontSize: '0.9rem', color: '#ffb3b3' }}>{currentUser?.analysis_count || 0}/4 Free Used</span>
                  <button className="btn btn-primary btn-sm" style={{ padding: '4px 12px', fontSize: '0.8rem', height: 'auto' }} onClick={() => setShowUpgradeModal(true)}>Upgrade</button>
                </div>
              )}

              <div className="glass-panel" style={{ display: 'flex', padding: '6px', gap: '8px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setDocumentResults(null);
                    setStudioResult(null);
                    setActiveStudioTool(null);
                    setChatHistory([]);
                    setSelectedFile(null);
                    setTextInput("");
                    setActiveTab('upload');
                    setMultiSelectMode(false);
                    setSelectedHistoryIds([]);
                    setIsAnalyzing(false);
                    setIsAnalyzingStudio(false);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  style={{ border: 'none', boxShadow: 'none' }}
                >
                  <UploadCloud size={18} /> New Analysis
                </button>
              </div>
            </div>
          </header>

          <div className="animate-fade-in" style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0, justifyContent: 'center', width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Left Side: Workspace Area */}
            <div className="workspace-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflowY: 'auto' }}>
              {(!documentResults && !isLoadingHistory && activeTab !== 'deepdive') ? (
                <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="glass-panel" style={{ padding: '24px', marginBottom: '16px' }}>
                    <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={20} /> Upload & Analyze</h3>

                    {isAnalyzing ? (
                      <div className="upload-zone animated-border-zone" style={{ padding: '40px 20px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
                        <div className="animate-pulse-slow" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                          <Sparkles size={36} color="var(--primary)" style={{ marginBottom: '16px' }} />
                          <h4 style={{ color: 'var(--primary)', marginBottom: '8px' }}>Analyzing {selectedFile ? "Document" : "Content"}...</h4>
                          <p style={{ color: 'var(--text-muted)' }}>AI is extracting contents and generating insights.</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Text Input Row */}
                        <div style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '12px',
                          padding: '8px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          transition: 'all 0.2s ease',
                        }}
                          className="focus-within-ring"
                        >
                          <Search size={18} color="var(--text-muted)" />
                          <input
                            type="text"
                            placeholder="Paste URL, raw text, or type '/search [query]'..."
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-main)',
                              width: '100%',
                              fontSize: '1rem',
                              outline: 'none',
                              padding: '8px 0'
                            }}
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                          />
                          <button
                            className="btn btn-icon-only"
                            title="Search the web: type /search [query]"
                            style={{ background: textInput.startsWith('/search') ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)', border: 'none' }}
                            onClick={() => { if (!textInput.trim()) setTextInput('/search '); else handleAnalyze(); }}
                          >
                            {textInput.startsWith('/search') ? <Search size={16} color="var(--primary)" /> : <Send size={16} />}
                          </button>
                        </div>

                        {textInput.startsWith('/search ') && (
                          <div style={{ fontSize: '0.8rem', color: 'rgba(108,99,255,0.9)', background: 'rgba(108,99,255,0.08)', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Search size={13} /> Web search mode — press Enter or click Send to search the web
                          </div>
                        )}
                        {/* Drag and Drop Zone */}
                        <div
                          className={`upload-zone ${isDragging ? 'active' : ''}`}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          style={{ padding: selectedFile ? '30px 20px' : undefined }}
                        >
                          {!selectedFile ? (
                            <>
                              <h3 style={{ fontSize: '1.4rem', fontWeight: '500', marginBottom: '8px' }}>or drop your files</h3>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>pdf, images, docs, code, <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>and more</span></p>

                              <div className="source-badges-container">
                                <label className="source-badge">
                                  <UploadCloud size={16} /> Upload files
                                  <input type="file" ref={fileInputRef} onChange={handleFileChange} />
                                </label>
                                <div className="source-badge" onClick={() => document.querySelector('.clear-input').focus()}>
                                  <MessageSquare size={16} color="#ef4444" /> Websites
                                </div>
                                <div className="source-badge" onClick={() => document.querySelector('.clear-input').focus()}>
                                  <Copy size={16} /> Copied text
                                </div>
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: '16px 20px', background: 'rgba(79, 70, 229, 0.15)', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: '450px', margin: '0 auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                                <div style={{ background: 'rgba(79, 70, 229, 0.2)', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <FileText size={24} color="var(--primary)" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', overflow: 'hidden' }}>
                                  <span style={{ fontWeight: '600', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '250px' }}>{selectedFile.name}</span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ready for analysis</span>
                                </div>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ffb3b3', borderRadius: '50%', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                              >
                                <X size={18} />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Project/Folder Name */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'center', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Project Folder:</span>
                          <input
                            type="text"
                            value={folderInput}
                            onChange={(e) => setFolderInput(e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '6px',
                              color: 'var(--text-main)',
                              padding: '4px 8px',
                              fontSize: '0.9rem',
                              outline: 'none',
                              width: '150px'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="output-options" style={{ margin: '16px 0', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                      {[
                        { id: 'Summary', icon: <FileText size={16} />, label: 'Summary', desc: 'Short overview' },
                        { id: 'Detailed', icon: <Search size={16} />, label: 'Detailed', desc: 'In-depth report' },
                        { id: 'Bullet Points', icon: <List size={16} />, label: 'Key Points', desc: 'Bulleted facts' },
                        { id: 'Deep Dive', icon: <Sparkles size={16} />, label: 'Deep Dive', desc: 'Full analysis & interactive Chatbot' }
                      ].map(type => (
                        <div
                          key={type.id}
                          className={`output-option ${outputType === type.id ? 'selected' : ''}`}
                          onClick={() => setOutputType(type.id)}
                          style={{
                            padding: '8px 14px',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '8px',
                            borderRadius: '100px'
                          }}
                          title={type.desc} // Native browser tooltip for the description
                        >
                          <span style={{ color: outputType === type.id ? 'var(--primary)' : 'var(--text-muted)' }}>{type.icon}</span>
                          <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{type.label}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                    >
                      <Sparkles size={18} /> {isAnalyzing ? 'Analyzing...' : 'Analyze Content'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {/* Document Pane - Conditionally rendered 30% of the screen nicely on the left */}
                  {showDocumentViewer && (
                    <div
                      className="glass-panel animate-fade-in"
                      style={{
                        width: '30%',
                        height: '100%',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRight: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '10px 0 30px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                          <FileText size={20} className="text-gradient" /> Original Document
                        </h3>
                      </div>
                      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                        {documentResults?.content ? (
                          <pre style={{
                            whiteSpace: 'pre-wrap',
                            wordWrap: 'break-word',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            lineHeight: '1.5'
                          }}>
                            {documentResults.content}
                          </pre>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                            No document content available for viewing.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chat Pane - Takes up remaining screen space nicely on the right */}
                  <div className="chat-container animate-fade-in" style={{ flex: 1, minHeight: 0 }}>
                    <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', paddingRight: '16px' }}>
                      {isLoadingHistory ? (
                        <div className="message ai" style={{ maxWidth: '100%' }}>
                          <div className="message-avatar"><Bot size={20} /></div>
                          <div className="message-content" style={{
                            background: 'linear-gradient(145deg, rgba(22, 22, 24, 0.9) 0%, rgba(30, 30, 32, 0.95) 100%)',
                            border: '1px solid rgba(79, 70, 229, 0.4)',
                            padding: '24px',
                            width: '100%',
                            borderRadius: '16px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                              <Clock size={18} className="spin-slow" /> Retrieving context from memory...
                            </div>
                            <SkeletonLoader />
                            <br />
                            <SkeletonLoader />
                          </div>
                        </div>
                      ) : documentResults ? (
                        <div className="message ai" style={{ maxWidth: '100%' }}>
                          <div className="message-avatar"><Bot size={20} /></div>
                          <div className="message-content markdown-wrapper" id="deep-dive-report" style={{
                            lineHeight: '1.7',
                            fontSize: '1.05rem',
                            background: 'linear-gradient(145deg, rgba(22, 22, 24, 0.9) 0%, rgba(30, 30, 32, 0.95) 100%)',
                            border: '1px solid rgba(79, 70, 229, 0.4)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            padding: '24px',
                            width: '100%',
                            borderRadius: '16px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                              <p style={{ fontWeight: '600', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <FileText size={20} color="var(--accent)" /> I've analyzed: <span style={{ color: 'var(--text-main)', fontWeight: '700', marginRight: '8px' }}>{documentResults.fileName || 'Provided Text'}</span>
                                <TextToSpeechButton text={documentResults.description} />
                              </p>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {documentResults && (
                                  <>
                                    <button onClick={() => setShowDocumentViewer(!showDocumentViewer)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem', background: showDocumentViewer ? 'rgba(79, 70, 229, 0.2)' : 'transparent', borderColor: showDocumentViewer ? 'rgba(79, 70, 229, 0.5)' : 'rgba(255,255,255,0.2)' }} title={showDocumentViewer ? 'Close document preview' : 'Preview the original extracted document text'}>
                                      <FileText size={16} /> {showDocumentViewer ? '✕ Hide Source' : '👁 View Source'}
                                    </button>
                                    <button onClick={handleShare} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem', background: 'rgba(79, 70, 229, 0.1)', borderColor: 'rgba(79, 70, 229, 0.5)' }}>
                                      <Share2 size={16} /> Share Link
                                    </button>
                                    <button onClick={exportToPDF} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontSize: '0.9rem' }}>
                                      <Download size={16} /> Export
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                              {/* Description — rendered instantly so the chat is immediately usable */}
                              <div style={{ width: '100%', opacity: 0.9 }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
                                  {documentResults.description}
                                </ReactMarkdown>
                              </div>

                              {/* Suggested Questions — only shown in Deep Dive mode */}
                              {outputType === 'Deep Dive' && documentResults.questions && documentResults.questions.length > 0 && (
                                <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
                                  <p style={{ color: 'var(--text-muted)', fontWeight: '500', marginBottom: '14px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Sparkles size={15} color="var(--accent)" /> Ask a follow-up
                                  </p>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {documentResults.questions.map((q, idx) => {
                                      const cleanQ = q.replace(/^\d+\.\s*/, '').replace(/^-\s*/, '').replace(/\*/g, '').trim();
                                      if (!cleanQ) return null;
                                      return (
                                        <button
                                          key={idx}
                                          className="suggested-q-btn"
                                          style={{
                                            padding: '8px 14px',
                                            textAlign: 'left',
                                            borderRadius: '100px',
                                            border: '1px solid rgba(108,99,255,0.25)',
                                            background: 'rgba(108,99,255,0.07)',
                                            transition: 'all 0.2s ease',
                                            color: 'var(--text-main)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            lineHeight: '1.4',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                          }}
                                          onMouseOver={(e) => {
                                            e.currentTarget.style.background = 'rgba(108,99,255,0.18)';
                                            e.currentTarget.style.borderColor = 'rgba(108,99,255,0.5)';
                                          }}
                                          onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'rgba(108,99,255,0.07)';
                                            e.currentTarget.style.borderColor = 'rgba(108,99,255,0.25)';
                                          }}
                                          onClick={() => {
                                            setActiveTab('deepdive');
                                            if (isMobileViewport) setMobileTab('chat');
                                            setTimeout(() => handleChatSubmit(cleanQ), 50);
                                          }}
                                        >
                                          <MessageSquare size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                                          <span>{cleanQ}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}


                            </div>
                          </div>
                        </div>
                      ) : (multiSelectMode && selectedHistoryIds.length > 0) ? (
                        <div className="message ai" style={{ maxWidth: '100%' }}>
                          <div className="message-avatar"><Bot size={20} /></div>
                          <div className="message-content markdown-wrapper" id="deep-dive-report" style={{
                            lineHeight: '1.7',
                            fontSize: '1.05rem',
                            background: 'linear-gradient(145deg, rgba(22, 22, 24, 0.9) 0%, rgba(30, 30, 32, 0.95) 100%)',
                            border: '1px solid rgba(79, 70, 229, 0.4)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            padding: '24px',
                            width: '100%',
                            borderRadius: '16px'
                          }}>
                            <div style={{ paddingBottom: '8px' }}>
                              <p style={{ fontWeight: '600', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <FileText size={20} color="var(--accent)" /> I am ready to answer questions across your <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>{selectedHistoryIds.length} connected documents</span>!
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="message ai">
                          <div className="message-avatar"><Bot size={20} /></div>
                          <div className="message-content">
                            Please upload and analyze a document first to start a deep dive!
                          </div>
                        </div>
                      )}

                      {chatHistory.map((msg, i) => (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={i}
                          className={`message ${msg.role}`}
                        >
                          <div className="message-avatar">{msg.role === 'ai' ? <Bot size={20} /> : (currentUser?.username?.charAt(0) || 'U')}</div>
                          <div className={`message-content ${msg.role === 'ai' ? 'markdown-wrapper' : ''}`} style={{ lineHeight: '1.6', position: 'relative' }}>
                            {msg.role === 'ai' ? (
                              <>
                                <TypewriterText text={msg.content} delay={5} />
                                <div style={{ marginTop: '16px', display: 'flex' }}>
                                  <TextToSpeechButton text={msg.content} />
                                </div>
                              </>
                            ) : (
                              msg.content
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {isSending && (
                        <div className="message ai">
                          <div className="message-avatar"><Bot size={20} /></div>
                          <div className="message-content" style={{ width: '400px', maxWidth: '100%' }}>
                            <SkeletonLoader />
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <div style={{ position: 'relative', flexShrink: 0, marginTop: 'auto' }}>
                      <input
                        type="text"
                        className="chat-input"
                        placeholder="Ask a question about your document..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleChatSubmit()}
                        disabled={(!documentResults && (!multiSelectMode || selectedHistoryIds.length === 0)) || isSending}
                      />
                      <button
                        className="chat-submitBtn"
                        onClick={() => handleChatSubmit()}
                        disabled={(!documentResults && (!multiSelectMode || selectedHistoryIds.length === 0)) || isSending}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Studio Sidebar (Always Visible) */}
            {!studioCollapsed && <div className={`resize-handle ${isResizingStudio ? 'active' : ''}`} onMouseDown={() => setIsResizingStudio(true)}></div>}
            <div className="glass-panel animate-fade-in studio-sidebar" style={{
              width: (activeStudioTool || studioResult) ? `${studioWidth}px` : (studioCollapsed ? '80px' : '360px'),
              flexShrink: 0,
              transition: isResizingStudio ? 'none' : 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: studioCollapsed ? 'center' : 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {activeStudioTool ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => { setActiveStudioTool(null); setStudioResult(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: '1rem' }}>Studio &gt; </span>
                    </button>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 500, display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>{activeStudioTool.icon} {activeStudioTool.label}</span>
                    </h3>
                  </div>
                ) : (
                  !studioCollapsed && <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 500 }}>Studio</h3>
                )}
                {!activeStudioTool && (
                  <button onClick={() => setStudioCollapsed(!studioCollapsed)} className="btn-icon-only" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Columns size={20} />
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: (studioCollapsed && !activeStudioTool) ? '20px 0' : '20px', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: (studioCollapsed && !activeStudioTool) ? 'center' : 'stretch' }}>
                {isAnalyzingStudio ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                    <div className="animate-pulse-slow"><Sparkles size={48} color="var(--primary)" /></div>
                    <p style={{ color: 'var(--text-muted)' }}>Generating {activeStudioTool?.label}...</p>
                  </div>
                ) : studioResult ? (
                  <div className="animate-fade-in" style={{ padding: '0 6px' }}>
                    {activeStudioTool?.id === 'flashcards' ? (
                      <FlashcardRenderer text={studioResult} />
                    ) : activeStudioTool?.id === 'quiz' ? (
                      <QuizRenderer text={studioResult} />
                    ) : (
                      <div className="markdown-wrapper" style={{ fontSize: '1.05rem', lineHeight: '1.6' }}>
                        <TypewriterText text={studioResult} delay={3} />
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {!studioCollapsed && (
                      <div style={{ padding: '16px', background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.1) 0%, rgba(34, 211, 238, 0.1) 100%)', borderRadius: '12px', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', margin: 0 }}>
                          Create an Audio Overview in: <span style={{ color: 'var(--text-muted)' }}>हिन्दी, বাংলা, ગુજરાતી, ಕನ್ನಡ, മലയാളം, मराठी, ਪੰਜਾਬੀ, தமிழ், తెలుగు</span>
                        </p>
                      </div>
                    )}

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: studioCollapsed ? '1fr' : 'repeat(2, 1fr)',
                      gap: '12px',
                      width: '100%'
                    }}>
                      {[
                        { id: 'audio', label: 'Audio Overview', icon: <Volume2 size={20} /> },
                        { id: 'slide', label: 'Slide deck', icon: <Monitor size={20} /> },
                        { id: 'video', label: 'Video Overview', icon: <Video size={20} /> },
                        { id: 'mindmap', label: 'Mind Map', icon: <Network size={20} /> },
                        { id: 'reports', label: 'Reports', icon: <FileText size={20} /> },
                        { id: 'flashcards', label: 'Flashcards', icon: <Layers size={20} /> },
                        { id: 'quiz', label: 'Quiz', icon: <HelpCircle size={20} /> },
                        { id: 'infographic', label: 'Infographic', icon: <BarChart size={20} /> },
                        { id: 'datatable', label: 'Data table', icon: <Table size={20} /> }
                      ].map(feat => (
                        <div key={feat.id} className="studio-btn" style={{
                          padding: studioCollapsed ? '12px' : '16px',
                          display: 'flex',
                          flexDirection: studioCollapsed ? 'row' : 'column',
                          justifyContent: 'center',
                          alignItems: studioCollapsed ? 'center' : 'flex-start',
                          gap: '12px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          width: studioCollapsed ? '48px' : 'auto',
                          height: studioCollapsed ? '48px' : 'auto',
                          margin: studioCollapsed ? '0 auto' : '0'
                        }}
                          title={studioCollapsed ? feat.label : undefined}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!selectedFile && !textInput.trim() && !documentResults) {
                              toast.warning("Please upload a document or paste context here first to create a " + feat.label + "!");
                              return;
                            }
                            setOutputType(feat.id);
                            handleAnalyze(feat.id, feat);
                          }}
                        >
                          <div style={{ color: 'var(--text-muted)', display: 'flex' }}>{feat.icon}</div>
                          {!studioCollapsed && <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 500 }}>{feat.label}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main >
      </div >
    </div >
  );
}

/* ── FLASHCARD RENDERER ── */
function FlashcardRenderer({ text }) {
  const cards = [];
  const blocks = text.split(/Q:|Question:/i).filter(b => b.trim());
  blocks.forEach(block => {
    const parts = block.split(/A:|Answer:/i);
    if (parts.length >= 2) {
      cards.push({ q: parts[0].trim().replace(/^\d+\.\s*/, ''), a: parts.slice(1).join('').trim() });
    }
  });
  if (cards.length === 0) {
    return <div className="markdown-wrapper" style={{ fontSize: '1rem', lineHeight: '1.6' }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>💡 Click a card to reveal the answer</p>
      {cards.map((card, i) => <FlipCard key={i} index={i} q={card.q} a={card.a} />)}
    </div>
  );
}

function FlipCard({ index, q, a }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div onClick={() => setFlipped(f => !f)} style={{ cursor: 'pointer', perspective: '1000px' }}>
      <div style={{
        position: 'relative', minHeight: '90px', transformStyle: 'preserve-3d',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        transition: 'transform 0.45s cubic-bezier(0.16,1,0.3,1)',
      }}>
        {/* Front */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '14px',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(108,99,255,0.8)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Q {index + 1}</span>
          <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.55 }}>{q}</span>
        </div>
        {/* Back */}
        <div style={{
          position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'rgba(0,229,196,0.08)', border: '1px solid rgba(0,229,196,0.3)', borderRadius: '14px',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '6px',
        }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(0,229,196,0.8)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Answer</span>
          <span style={{ color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.55 }}>{a}</span>
        </div>
      </div>
    </div>
  );
}

/* ── QUIZ RENDERER ── */
function QuizRenderer({ text }) {
  const [answers, setAnswers] = useState({});
  const questions = [];
  const qBlocks = text.split(/\n(?=\d+\.\s)/);
  qBlocks.forEach((block, qi) => {
    const lines = block.trim().split('\n').filter(l => l.trim());
    if (!lines.length) return;
    const qText = lines[0].replace(/^\d+\.\s*/, '').trim();
    const opts = lines.slice(1).filter(l => /^[A-Da-d][\).\s]/.test(l.trim()));
    const answerLine = lines.find(l => /correct|answer/i.test(l));
    const correct = answerLine ? answerLine.match(/[A-Da-d]/)?.[0]?.toUpperCase() : null;
    if (qText && opts.length > 0) questions.push({ q: qText, opts, correct, id: qi });
  });
  if (questions.length === 0) {
    return <div className="markdown-wrapper" style={{ fontSize: '1rem', lineHeight: '1.6' }}><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>🎯 Select an answer for each question</p>
      {questions.map((q) => (
        <div key={q.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '18px 20px' }}>
          <p style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '14px' }}>
            {q.id + 1}. {q.q}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {q.opts.map((opt, oi) => {
              const letter = opt.trim()[0].toUpperCase();
              const chosen = answers[q.id] === letter;
              const correct = q.correct && letter === q.correct;
              const wrong = chosen && q.correct && !correct;
              return (
                <button key={oi}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.id]: letter }))}
                  style={{
                    textAlign: 'left', padding: '10px 16px', borderRadius: '10px', border: '1px solid',
                    borderColor: chosen ? (correct ? 'rgba(52,211,153,0.5)' : wrong ? 'rgba(239,68,68,0.5)' : 'rgba(108,99,255,0.5)') : 'rgba(255,255,255,0.08)',
                    background: chosen ? (correct ? 'rgba(52,211,153,0.1)' : wrong ? 'rgba(239,68,68,0.1)' : 'rgba(108,99,255,0.1)') : 'rgba(255,255,255,0.02)',
                    color: 'var(--text-main)', fontSize: '0.88rem', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                  <span style={{ fontWeight: 700, opacity: 0.7 }}>{letter}.</span>
                  {opt.trim().slice(2).trim()}
                  {answers[q.id] && correct && <span style={{ marginLeft: 'auto', color: '#34D399' }}>✓</span>}
                  {wrong && <span style={{ marginLeft: 'auto', color: '#f87171' }}>✗</span>}
                </button>
              );
            })}
          </div>
          {answers[q.id] && q.correct && answers[q.id] !== q.correct && (
            <p style={{ marginTop: '10px', fontSize: '0.82rem', color: '#34D399' }}>Correct answer: <strong>{q.correct}</strong></p>
          )}
        </div>
      ))}
    </div>
  );
}

function HistoryItem({ title, date, type, active, studioFeatures, onClick, onDelete, multiSelectMode, isSelected, onRename }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(title);
  const featLabels = (studioFeatures || []).map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ');

  const commitRename = (e) => {
    e.stopPropagation();
    if (editVal.trim() && editVal !== title) onRename(editVal.trim());
    setIsEditing(false);
  };

  return (
    <div className={`history-item ${active ? 'active' : ''} ${isSelected ? 'selected' : ''}`} onClick={isEditing ? undefined : onClick}
      style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isSelected ? 'rgba(79, 70, 229, 0.2)' : undefined, border: isSelected ? '1px solid rgba(79, 70, 229, 0.5)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
        {multiSelectMode && (
          <div style={{ width: '16px', height: '16px', borderRadius: '4px', border: '1px solid var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? 'var(--primary)' : 'transparent', flexShrink: 0 }}>
            {isSelected && <Check size={12} color="#fff" />}
          </div>
        )}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          {isEditing ? (
            <input
              autoFocus
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(e); if (e.key === 'Escape') setIsEditing(false); }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(108,99,255,0.4)', borderRadius: '6px', color: 'var(--text-main)', padding: '3px 8px', fontSize: '0.88rem', width: '100%', outline: 'none' }}
            />
          ) : (
            <div className="history-title" onDoubleClick={e => { e.stopPropagation(); setIsEditing(true); }}>{title}</div>
          )}
          <div className="history-meta">{date}{featLabels ? ` • Studio: ${featLabels}` : ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
        <button className="btn-icon-only" title="Rename (or double-click)" style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)', opacity: 0.6 }} onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
        <button className="btn-icon-only" style={{ padding: '5px', background: 'transparent', border: 'none', color: 'var(--text-muted)' }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function AuthScreen({ onLogin, initialMode = 'login' }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Wake backend while user types credentials to reduce first-login latency.
    axios.get(`${API_BASE}/health`, { timeout: 4000 }).catch(() => { });
  }, []);

  const handleSubmit = async () => {
    if (!username || !password) return toast.warning("Please fill in all fields");
    if (!isLogin && password !== confirmPassword) return toast.error("Passwords do not match");

    setLoading(true);
    try {
      if (isLogin) {
        const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
        if (res.data.success) {
          toast.success("Login Successful");
          onLogin(res.data.user, res.data.token);
        } else {
          toast.error('Login failed: ' + res.data.message);
        }
      } else {
        const res = await axios.post(`${API_BASE}/auth/register`, { username, password });
        if (res.data.success) {
          toast.success("Registration successful! Welcome to OmniDoc.");
          onLogin(res.data.user, res.data.token);
        } else {
          toast.error('Registration failed: ' + res.data.message);
        }
      }
    } catch (err) {
      toast.error("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="glass-panel auth-card">
        <div className="auth-header">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <img src={logoUrl} alt="logo" style={{ width: '56px', height: '56px', objectFit: 'contain' }} />
          </div>
          <h1 className="text-gradient">OMNIDOC AI</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Your intelligent document companion</p>
        </div>

        <div className="input-group">
          <label className="input-label">Username</label>
          <input
            type="text"
            className="input-field"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Password</label>
          <input
            type="password"
            className="input-field"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {!isLogin && (
          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '24px' }} onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
        </button>

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: '500' }}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default App;
