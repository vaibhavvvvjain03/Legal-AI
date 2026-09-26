"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { FileText, Search, AlertCircle, FilePlus, Zap, Scale, FileDiff, X, CheckCircle, Lock, Shield, Server, Zap as ZapIcon, Key } from "lucide-react";
import { processUploadedDocument, askQuestion, scanDocument, compareDocs } from "@/actions/document";
import { DocumentChunk } from "@/lib/pdf-parser";
import { GroundedAnswer, ScanResult, CompareResult } from "@/lib/gemini";

type RightTab = "QA" | "SCAN" | "COMPARE";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text?: string;
  answer?: GroundedAnswer;
  isLoading?: boolean;
}

export default function Home() {
  type ModalType = "FEATURES" | "PRICING" | "ENTERPRISE" | "API_DOCS" | "LOGIN" | null;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setSplashFading(true);
    }, 2500);
    const timer2 = setTimeout(() => {
      setShowSplash(false);
    }, 3200);
    return () => { clearTimeout(timer1); clearTimeout(timer2); };
  }, []);
  const closeModal = () => {
    setIsClosing(true);
    setTimeout(() => {
      setActiveModal(null);
      setIsClosing(false);
    }, 550); // wait for 600ms animation
  };

  // Document State
  const [docAChunks, setDocAChunks] = useState<DocumentChunk[]>([]);
  const [docBChunks, setDocBChunks] = useState<DocumentChunk[]>([]);
  const [activeLeftTab, setActiveLeftTab] = useState<"A" | "B">("A");
  
  // Right Pane State
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("QA");

  // Loading States
  const [isUploading, setIsUploading] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // Result States
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const chunkRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, isDocB: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    
    const result = await processUploadedDocument(formData);
    if (result.chunks && result.chunks.length > 0) {
      if (isDocB) {
        setDocBChunks(result.chunks);
        setActiveLeftTab("B");
        setActiveRightTab("COMPARE"); // Auto-switch to compare when B is uploaded
      } else {
        setDocAChunks(result.chunks);
        setChatHistory([]);
        setScanResult(null);
        setCompareResult(null);
      }
    } else {
      alert(result.error || "Failed to extract text from PDF.");
    }
    setIsUploading(false);
    // Reset file input
    e.target.value = '';
  };

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || docAChunks.length === 0) return;
    
    const currentQuestion = question;
    const userMessage: ChatMessage = { id: Date.now().toString(), role: "user", text: currentQuestion };
    const loadingMessageId = (Date.now() + 1).toString();
    const loadingMessage: ChatMessage = { id: loadingMessageId, role: "assistant", isLoading: true };
    
    setChatHistory(prev => [...prev, userMessage, loadingMessage]);
    setQuestion("");
    setIsAsking(true);
    setActiveHighlight(null);
    
    // Auto scroll happens via useEffect, but just in case
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const result = await askQuestion(currentQuestion, docAChunks);
    
    setChatHistory(prev => prev.map(msg => {
      if (msg.id === loadingMessageId) {
        return { 
          ...msg, 
          isLoading: false, 
          answer: result.answer || undefined,
          text: result.error ? `Error: ${result.error}` : undefined 
        };
      }
      return msg;
    }));
    setIsAsking(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleScan = async () => {
    if (docAChunks.length === 0) return;
    setIsScanning(true);
    setActiveHighlight(null);
    const result = await scanDocument(docAChunks);
    if (result.result) {
      setScanResult(result.result);
    } else {
      alert(result.error || "Failed to scan document.");
    }
    setIsScanning(false);
  };

  const handleCompare = async () => {
    if (docAChunks.length === 0 || docBChunks.length === 0) return;
    setIsComparing(true);
    setActiveHighlight(null);
    const result = await compareDocs(docAChunks, docBChunks);
    if (result.result) {
      setCompareResult(result.result);
    } else {
      alert(result.error || "Failed to compare documents.");
    }
    setIsComparing(false);
  };

  const handleCitationClick = (id: string, switchToDoc?: "A" | "B") => {
    if (switchToDoc && switchToDoc !== activeLeftTab) {
      setActiveLeftTab(switchToDoc);
    }
    
    setActiveHighlight(null);
    // Force reflow to restart animation
    setTimeout(() => {
      setActiveHighlight(id);
      const element = chunkRefs.current[id];
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);
  };

  const activeChunks = activeLeftTab === "A" ? docAChunks : docBChunks;

  return (
    <>
      {showSplash && (
        <div className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#FDFBF7] transition-all duration-700 ease-in-out ${splashFading ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
          {/* Subtle Ambient Halo */}
          <div className="absolute w-72 h-72 rounded-full bg-ink/[0.03] blur-2xl pointer-events-none animate-pulse" />

          {/* Centered Small Architectural Emblem */}
          <div 
            className="relative mb-3 flex items-center justify-center"
            style={{ animation: 'emblemEntrance 1.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
          >
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56">
              <Image 
                src="/banner_final.jpg" 
                alt="Legal AI Emblem" 
                fill
                className="object-contain mix-blend-multiply select-none pointer-events-none" 
                priority
              />
            </div>
          </div>

          {/* Animated Inward "Legal AI" Text */}
          <div className="flex flex-col items-center text-center px-4">
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl font-black text-ink uppercase tracking-tight select-none"
              style={{ animation: 'legalAiInwards 2s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
              Legal AI
            </h1>
            <div 
              className="h-[2px] bg-ink/40 mt-3 rounded-full"
              style={{ animation: 'lineExpand 1.5s ease-out 0.4s both' }}
            />
          </div>
        </div>
      )}

      <div className={`h-screen flex flex-col bg-paper text-ink font-sans selection:bg-ink/20 transition-opacity duration-1000 ${showSplash && !splashFading ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100 h-screen'}`}>
      
      {/* SaaS Header */}
      <header className="flex-none sticky top-0 z-50 bg-paper/90 backdrop-blur-md border-b border-ink/10 px-6 py-4 flex items-center justify-between animate-fade-in shadow-sm">
        <div className="flex items-center gap-2 text-ink hover:opacity-80 transition-opacity cursor-pointer">
          <div className="bg-ink text-paper p-1.5 rounded-md">
            <Scale size={20} />
          </div>
          <span className="font-bold text-xl tracking-tight">Legal AI</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink/70">
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveModal("FEATURES"); }} className="hover:text-ink transition-colors relative group">
            Features
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-ink transition-all group-hover:w-full"></span>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveModal("PRICING"); }} className="hover:text-ink transition-colors relative group">
            Pricing
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-ink transition-all group-hover:w-full"></span>
          </a>
          <a href="#" onClick={(e) => { e.preventDefault(); setActiveModal("ENTERPRISE"); }} className="hover:text-ink transition-colors relative group">
            Enterprise
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-ink transition-all group-hover:w-full"></span>
          </a>
          <button onClick={() => setActiveModal("API_DOCS")} className="border border-ink text-ink px-3 py-1 font-semibold rounded-sm hover:bg-ink hover:text-paper transition-all">
            API Docs
          </button>
        </nav>
        
        <div className="flex items-center gap-6">
          <button onClick={() => setActiveModal("LOGIN")} className="text-sm font-bold text-ink hover:opacity-70 transition-opacity">
            Log In
          </button>
          <button onClick={() => setActiveModal("LOGIN")} className="bg-ink text-paper text-sm font-bold px-5 py-2.5 rounded-full hover:bg-ink/90 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
            Get Started
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <div className="flex-1 min-h-0 container mx-auto p-4 md:p-6 lg:p-8 flex flex-col animate-fade-in-up">
        
        {/* Glassmorphic Workspace Card */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row bg-white/40 backdrop-blur-xl rounded-2xl shadow-2xl border border-ink/5 overflow-hidden ring-1 ring-ink/5 relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none opacity-50" />
          
          {/* Left Pane: Document Viewer */}
          <main className="relative z-10 w-full md:w-1/2 h-full flex flex-col border-r border-ink/10 bg-white/50 backdrop-blur-sm">
            <header className="flex-none p-4 border-b border-ink/10 flex items-center justify-between bg-paper/30">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveLeftTab("A")}
              className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeLeftTab === "A" ? 'border-ink text-ink' : 'border-transparent text-ink/50 hover:text-ink/80'}`}
            >
              Document A
            </button>
            {docBChunks.length > 0 && (
              <button 
                onClick={() => setActiveLeftTab("B")}
                className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeLeftTab === "B" ? 'border-ink text-ink' : 'border-transparent text-ink/50 hover:text-ink/80'}`}
              >
                Document B
              </button>
            )}
          </div>
          
          <div className="flex gap-3">
            <label className="cursor-pointer flex items-center gap-1 text-sm text-ink/60 hover:text-ink transition-colors">
              <FilePlus size={16} />
              <span>Replace A</span>
              <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => handleUpload(e, false)} disabled={isUploading} />
            </label>
            {docAChunks.length > 0 && (
              <label className="cursor-pointer flex items-center gap-1 text-sm text-ink/60 hover:text-ink transition-colors">
                <FileDiff size={16} />
                <span>Upload B (Compare)</span>
                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => handleUpload(e, true)} disabled={isUploading} />
              </label>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          {activeChunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink/50 space-y-4">
              <FileText size={48} />
              <h2 className="text-xl font-medium">Upload {activeLeftTab === "A" ? "Primary Document" : "Comparison Document"}</h2>
              <label className="cursor-pointer bg-ink text-paper px-6 py-2 hover:bg-ink/90 transition-colors focus-within:ring-2 focus-within:ring-obligation focus-within:ring-offset-2 focus-within:ring-offset-paper">
                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => handleUpload(e, activeLeftTab === "B")} disabled={isUploading} />
                {isUploading ? "Parsing..." : "Select PDF"}
              </label>
            </div>
          ) : (
            <article className="font-serif max-w-2xl mx-auto space-y-6 text-lg leading-relaxed text-ink">
              {activeChunks.map((chunk) => {
                // If we have scan results and are viewing Doc A, see if this chunk has tags
                const tags = activeLeftTab === "A" && scanResult?.flags 
                  ? scanResult.flags.filter(f => f.chunkId === chunk.id)
                  : [];

                return (
                  <div 
                    key={chunk.id} 
                    ref={(el) => { chunkRefs.current[chunk.id] = el; }}
                    className={`relative pl-12 py-1 transition-colors ${activeHighlight === chunk.id ? 'highlight-flash' : ''}`}
                  >
                    <span className="absolute left-0 top-2 text-sm font-sans text-ink/40 select-none">
                      {chunk.id}
                    </span>
                    <p>{chunk.text}</p>
                    
                    {tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tags.map((tag, i) => (
                          <span key={i} className={`text-xs font-sans font-medium px-2 py-0.5 border rounded-sm ${tag.type === 'RISK' ? 'text-risk border-risk' : tag.type === 'OBLIGATION' ? 'text-obligation border-obligation' : 'text-citation border-citation'}`}>
                            {tag.type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </article>
          )}
        </div>
          </main>

          {/* Right Pane: Assistant */}
          <aside className="relative z-10 w-full md:w-1/2 h-full flex flex-col p-8 font-sans bg-paper/20 backdrop-blur-sm">
            <header className="flex-none mb-8">
          <h1 className="text-2xl font-bold text-ink mb-6">Grounded Legal Assistant</h1>
          
          <div className="flex gap-6 border-b border-ink/10 pb-2">
            <button 
              onClick={() => setActiveRightTab("QA")}
              className={`text-sm font-medium uppercase tracking-wider transition-colors ${activeRightTab === "QA" ? 'text-ink' : 'text-ink/40 hover:text-ink/80'}`}
            >
              Q&A
            </button>
            <button 
              onClick={() => setActiveRightTab("SCAN")}
              className={`text-sm font-medium uppercase tracking-wider transition-colors flex items-center gap-1 ${activeRightTab === "SCAN" ? 'text-ink' : 'text-ink/40 hover:text-ink/80'}`}
            >
              <Zap size={14} /> Scan
            </button>
            <button 
              onClick={() => setActiveRightTab("COMPARE")}
              className={`text-sm font-medium uppercase tracking-wider transition-colors flex items-center gap-1 ${activeRightTab === "COMPARE" ? 'text-ink' : 'text-ink/40 hover:text-ink/80'}`}
            >
              <Scale size={14} /> Compare
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto mb-8 pr-4">
          
          {/* TAB: Q&A */}
          {activeRightTab === "QA" && (
            <div className="h-full flex flex-col">
              <div className="flex-1 flex flex-col gap-4 pb-4 overflow-y-auto pr-2 scroll-smooth">
                {chatHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-50 text-center mt-12">
                    <Search size={48} className="mb-4 text-ink/30" />
                    <p className="text-sm">Ask a question about the document to begin.</p>
                  </div>
                ) : (
                  chatHistory.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="bg-ink text-paper px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[85%] text-sm shadow-sm">
                          {msg.text}
                        </div>
                      ) : (
                        <div className="bg-white/60 backdrop-blur-sm border border-ink/10 px-5 py-4 rounded-2xl rounded-bl-sm max-w-[95%] text-sm shadow-sm">
                          {msg.isLoading ? (
                            <div className="flex items-center gap-2 text-ink/60 animate-pulse font-medium">
                              <Search size={14} className="animate-bounce" /> Searching document...
                            </div>
                          ) : msg.answer?.notFound ? (
                            <div className="flex items-start gap-3 text-ink">
                              <AlertCircle className="shrink-0 mt-0.5 text-risk" size={16} />
                              <div>
                                <h3 className="font-medium text-risk mb-1 text-xs">Not Addressed in Document</h3>
                                <p className="opacity-80">The document does not contain an answer to this question.</p>
                              </div>
                            </div>
                          ) : msg.answer ? (
                            <div className="space-y-2 text-ink">
                              {msg.answer.confidence && (
                                <h3 className="font-bold text-[10px] uppercase tracking-wider text-ink/50">
                                  Confidence: {msg.answer.confidence}
                                </h3>
                              )}
                              <p className="leading-relaxed">
                                {msg.answer.answer}
                                {msg.answer.citedChunkId && (
                                  <button 
                                    onClick={() => handleCitationClick(msg.answer!.citedChunkId!, "A")}
                                    className="ml-2 text-citation font-medium hover:underline px-1.5 py-0.5 rounded-md border border-citation/30 bg-citation/5 transition-colors hover:bg-citation/10"
                                  >
                                    [A:{msg.answer.citedChunkId}]
                                  </button>
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="text-risk font-medium">{msg.text}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              
              <form onSubmit={handleAsk} className="flex gap-3 mt-auto pt-4 border-t border-ink/10">
                <div className="flex-1 relative">
                  <input 
                    id="question"
                    type="text" 
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about Document A..."
                    className="w-full bg-transparent border-b-2 border-ink/20 py-3 pl-2 pr-10 focus:outline-none focus:border-ink transition-colors text-ink placeholder:text-ink/40"
                    disabled={isAsking || docAChunks.length === 0}
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-ink/40" size={20} />
                </div>
                <button 
                  type="submit" 
                  disabled={isAsking || docAChunks.length === 0 || !question.trim()}
                  className="bg-ink text-paper px-6 py-3 font-medium hover:bg-ink/90 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-obligation"
                >
                  {isAsking ? "Searching..." : "Ask"}
                </button>
              </form>
            </div>
          )}

          {/* TAB: SCAN */}
          {activeRightTab === "SCAN" && (
            <div className="space-y-6 text-ink">
              <p className="opacity-80 leading-relaxed">
                Automatically audit Document A for strict obligations, liabilities, and conflicting clauses.
              </p>
              
              {!scanResult ? (
                <button 
                  onClick={handleScan}
                  disabled={isScanning || docAChunks.length === 0}
                  className="border-2 border-ink text-ink px-6 py-3 font-medium hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {isScanning ? "Auditing Document..." : "Run Risk & Obligation Audit"}
                </button>
              ) : (
                <div className="space-y-6">
                  {scanResult.flags.map((flag, idx) => (
                    <div key={idx} className="pb-4 border-b border-ink/10 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${flag.type === 'RISK' ? 'text-risk' : flag.type === 'OBLIGATION' ? 'text-obligation' : 'text-citation'}`}>
                          {flag.type}
                        </span>
                        <button 
                          onClick={() => handleCitationClick(flag.chunkId, "A")}
                          className="text-citation text-sm font-medium hover:underline"
                        >
                          [A:{flag.chunkId}]
                        </button>
                      </div>
                      <p className="leading-relaxed">{flag.description}</p>
                    </div>
                  ))}
                  <button 
                    onClick={handleScan}
                    className="px-5 py-2 border border-ink/20 rounded-full text-sm font-medium text-ink/80 hover:border-ink hover:bg-ink/5 transition-all mt-4"
                  >
                    Rescan Document
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: COMPARE */}
          {activeRightTab === "COMPARE" && (
            <div className="space-y-6 text-ink">
              <p className="opacity-80 leading-relaxed">
                Generate a clause-level diff table between Document A and Document B.
              </p>
              
              {docBChunks.length === 0 ? (
                <div className="p-6 border border-dashed border-ink/20 flex flex-col items-center justify-center gap-4 text-center">
                  <p className="text-ink/60">Upload a second document to enable comparison.</p>
                  <label className="cursor-pointer border-2 border-ink text-ink px-6 py-2 hover:bg-ink hover:text-paper transition-colors font-medium">
                    <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => handleUpload(e, true)} disabled={isUploading} />
                    {isUploading ? "Uploading..." : "Upload Document B"}
                  </label>
                </div>
              ) : !compareResult ? (
                <button 
                  onClick={handleCompare}
                  disabled={isComparing}
                  className="border-2 border-ink text-ink px-6 py-3 font-medium hover:bg-ink hover:text-paper transition-colors disabled:opacity-50"
                >
                  {isComparing ? "Generating Diff..." : "Generate Clause Diff Table"}
                </button>
              ) : (
                <div className="space-y-6">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b-2 border-ink/20">
                        <th className="py-3 font-medium uppercase tracking-wider text-xs">Status</th>
                        <th className="py-3 font-medium uppercase tracking-wider text-xs">Description</th>
                        <th className="py-3 font-medium uppercase tracking-wider text-xs">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareResult.diffs.map((diff, idx) => (
                        <tr key={idx} className="border-b border-ink/10 align-top">
                          <td className="py-4 pr-4 w-24">
                            <span className={`text-xs font-bold uppercase tracking-wider ${
                              diff.status === 'ADDED' ? 'text-verified' : 
                              diff.status === 'REMOVED' ? 'text-risk' : 
                              'text-obligation'
                            }`}>
                              {diff.status}
                            </span>
                          </td>
                          <td className="py-4 pr-4 leading-relaxed">
                            {diff.description}
                          </td>
                          <td className="py-4 whitespace-nowrap text-sm">
                            {diff.clauseAId && (
                              <button onClick={() => handleCitationClick(diff.clauseAId!, "A")} className="text-citation hover:underline block">
                                [A:{diff.clauseAId}]
                              </button>
                            )}
                            {diff.clauseBId && (
                              <button onClick={() => handleCitationClick(diff.clauseBId!, "B")} className="text-citation hover:underline block">
                                [B:{diff.clauseBId}]
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex justify-start mt-6">
                    <button 
                      onClick={handleCompare}
                      className="px-5 py-2 border border-ink/20 rounded-full text-sm font-medium text-ink/80 hover:border-ink hover:bg-ink/5 transition-all"
                    >
                      Rerun Comparison
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
          </aside>
        </div>
      </div>

      {/* SaaS Footer */}
      <footer className="flex-none border-t border-ink/10 bg-paper/50 py-6 px-6 mt-auto relative">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between text-xs font-medium text-ink/60">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Scale size={14} className="opacity-70" />
            <p>© {new Date().getFullYear()} Legal AI, Inc. All rights reserved.</p>
          </div>
          <div className="flex gap-6">
            <a href="#" onClick={(e) => { e.preventDefault(); showToast("Privacy Policy loading..."); }} className="hover:text-ink transition-colors underline-offset-4 hover:underline">Privacy Policy</a>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast("Terms of Service loading..."); }} className="hover:text-ink transition-colors underline-offset-4 hover:underline">Terms of Service</a>
            <a href="#" onClick={(e) => { e.preventDefault(); showToast("Support contact coming soon!"); }} className="hover:text-ink transition-colors underline-offset-4 hover:underline">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[200] animate-fade-in-up">
          <div className="bg-ink text-paper px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 font-medium text-sm border border-white/10">
            <AlertCircle size={16} className="text-citation" />
            {toastMessage}
          </div>
        </div>
      )}

      {/* SaaS Full Page Overlay */}
      {activeModal && (
        <div className={`fixed inset-0 z-[100] bg-paper text-ink flex flex-col overflow-y-auto ${isClosing ? 'animate-slide-down-screen' : 'animate-slide-up-screen'}`}>
          {/* Header */}
          <div className="sticky top-0 z-20 bg-paper/90 backdrop-blur-md border-b border-ink/10 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-ink text-paper p-2 rounded-lg shadow-sm">
                <Scale size={24} className="animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-ink tracking-tight">
                {activeModal === "FEATURES" && "Platform Features"}
                {activeModal === "PRICING" && "Great Pricing Plans"}
                {activeModal === "ENTERPRISE" && "Scale to Enterprise"}
                {activeModal === "API_DOCS" && "Developer API Documentation"}
                {activeModal === "LOGIN" && "Workspace"}
              </h2>
            </div>
            <button onClick={closeModal} className="p-3 bg-ink/5 hover:bg-ink/10 rounded-full transition-colors flex items-center gap-2 font-bold text-ink/70 hover:text-ink">
              Close <X size={20} />
            </button>
          </div>
          
          {/* Body */}
          <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full p-6 md:p-12 lg:p-20">
              {activeModal === "FEATURES" && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <h3 className="text-3xl font-black text-ink mb-4 tracking-tight">The Most Advanced Legal AI</h3>
                    <p className="text-lg text-ink/70 max-w-2xl mx-auto">Upload documents, instantly extract insights, and compare clauses with pinpoint accuracy using our proprietary grounding engine.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-8 border border-ink/10 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <Search className="text-ink mb-6 bg-ink/5 p-3 rounded-xl w-14 h-14" />
                      <h4 className="text-xl font-bold mb-3">Grounded Q&A</h4>
                      <p className="text-ink/70 leading-relaxed">Ask any question about your contracts. We guarantee zero hallucinations by strictly citing exact chunks from the uploaded text.</p>
                    </div>
                    <div className="p-8 border border-ink/10 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <ZapIcon className="text-ink mb-6 bg-ink/5 p-3 rounded-xl w-14 h-14" />
                      <h4 className="text-xl font-bold mb-3">Instant Risk Scanning</h4>
                      <p className="text-ink/70 leading-relaxed">Automatically identify liabilities, severe penalties, and contradicting terms across massive documents in seconds.</p>
                    </div>
                    <div className="p-8 border border-ink/10 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <FileDiff className="text-ink mb-6 bg-ink/5 p-3 rounded-xl w-14 h-14" />
                      <h4 className="text-xl font-bold mb-3">Clause-Level Diff</h4>
                      <p className="text-ink/70 leading-relaxed">Compare multiple versions of a document. We instantly flag added, removed, and modified clauses with color-coded severity.</p>
                    </div>
                    <div className="p-8 border border-ink/10 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
                      <Shield className="text-ink mb-6 bg-ink/5 p-3 rounded-xl w-14 h-14" />
                      <h4 className="text-xl font-bold mb-3">Zero-Data Retention</h4>
                      <p className="text-ink/70 leading-relaxed">Your confidential files are processed entirely in-memory. Nothing is permanently stored or used to train public models.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "PRICING" && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <h3 className="text-3xl font-black text-ink mb-4 tracking-tight">Transparent, Scalable Pricing</h3>
                    <p className="text-lg text-ink/70 max-w-2xl mx-auto">From solo practitioners to global law firms, we have a plan that scales with your document volume.</p>
                  </div>
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Free */}
                    <div className="p-8 border border-ink/10 rounded-3xl bg-white flex flex-col shadow-sm">
                      <h4 className="text-xl font-bold mb-2">Free Tier</h4>
                      <div className="text-4xl font-black mb-6">$0<span className="text-base font-normal text-ink/50">/mo</span></div>
                      <ul className="space-y-4 mb-8 flex-1 text-sm font-medium">
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> 5 Document Scans / mo</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> Standard Q&A</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> 10MB file limit</li>
                      </ul>
                      <button className="w-full py-3.5 rounded-xl border border-ink/20 text-ink font-bold hover:border-ink hover:bg-ink/5 transition-colors">Start Free</button>
                    </div>
                    {/* Pro */}
                    <div className="p-8 border-2 border-ink rounded-3xl bg-ink text-paper flex flex-col relative shadow-2xl transform md:-translate-y-4">
                      <div className="absolute top-0 right-8 -translate-y-1/2 bg-citation text-ink px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">Most Popular</div>
                      <h4 className="text-xl font-bold mb-2 text-paper/90">Pro</h4>
                      <div className="text-4xl font-black mb-6">$49<span className="text-base font-normal opacity-70">/mo</span></div>
                      <ul className="space-y-4 mb-8 flex-1 text-sm font-medium">
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-citation shrink-0" /> 500 Document Scans / mo</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-citation shrink-0" /> Clause-Level Diffing</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-citation shrink-0" /> 100MB file limit</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-citation shrink-0" /> Priority Support</li>
                      </ul>
                      <button className="w-full py-3.5 rounded-xl bg-paper text-ink font-bold hover:bg-paper/90 transition-colors shadow-sm">Upgrade to Pro</button>
                    </div>
                    {/* Pro Max */}
                    <div className="p-8 border border-ink/10 rounded-3xl bg-white flex flex-col shadow-sm">
                      <h4 className="text-xl font-bold mb-2">Pro Max</h4>
                      <div className="text-4xl font-black mb-6">$199<span className="text-base font-normal text-ink/50">/mo</span></div>
                      <ul className="space-y-4 mb-8 flex-1 text-sm font-medium">
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> Unlimited Scans</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> API Access</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> Custom integrations</li>
                        <li className="flex gap-3 items-center"><CheckCircle size={18} className="text-verified shrink-0" /> Team collaboration</li>
                      </ul>
                      <button className="w-full py-3.5 rounded-xl border border-ink/20 text-ink font-bold hover:border-ink hover:bg-ink/5 transition-colors">Get Pro Max</button>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "ENTERPRISE" && (
                <div className="space-y-8">
                  <div className="text-center mb-12">
                    <div className="inline-block bg-citation/20 p-3 rounded-full mb-4">
                       <Server size={32} className="text-citation" />
                    </div>
                    <h3 className="text-3xl font-black text-ink mb-4 tracking-tight">Enterprise Grade Scalability</h3>
                    <p className="text-lg text-ink/70 max-w-3xl mx-auto leading-relaxed">How do we scale to big enterprises? By offering ultimate control, unparalleled security, and infrastructure built for the world&apos;s largest organizations and law firms.</p>
                  </div>
                  <div className="bg-ink text-paper p-10 rounded-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-citation opacity-20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                    <div className="grid md:grid-cols-2 gap-12 relative z-10">
                      <div>
                        <Server className="mb-6 text-citation" size={40} />
                        <h4 className="text-2xl font-bold mb-4">On-Premise & VPC Deployments</h4>
                        <p className="text-paper/80 leading-relaxed text-lg">For massive companies and government agencies, we offer fully air-gapped deployments. Run the Legal AI engine entirely within your own Virtual Private Cloud (AWS, GCP, Azure). Zero data leaves your network.</p>
                      </div>
                      <div>
                        <Lock className="mb-6 text-citation" size={40} />
                        <h4 className="text-2xl font-bold mb-4">SOC2 & HIPAA Compliant</h4>
                        <p className="text-paper/80 leading-relaxed text-lg">Every major scalability requirement is met out-of-the-box. We integrate seamlessly with your SSO (Okta, Azure AD, Ping), provide immutable audit logs, and guarantee 99.99% uptime SLAs.</p>
                      </div>
                    </div>
                    <div className="mt-12 pt-10 border-t border-paper/10 flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                      <div>
                        <h5 className="font-bold text-xl mb-2">Need a custom solution?</h5>
                        <p className="text-paper/70">Talk to our dedicated enterprise architects today.</p>
                      </div>
                      <button className="whitespace-nowrap px-8 py-4 bg-paper text-ink font-bold rounded-xl hover:bg-paper/90 transition-transform hover:scale-105 shadow-xl">Contact Enterprise Sales</button>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "API_DOCS" && (
                <div className="space-y-8">
                  <div className="text-center mb-10">
                    <h3 className="text-3xl font-black text-ink mb-4 tracking-tight">Developer API Integration</h3>
                    <p className="text-lg text-ink/70 max-w-2xl mx-auto">Connect your existing software directly to our grounding engine. Provide your own API keys for total control over billing and data processing.</p>
                  </div>
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-2xl border border-ink/10 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-ink/5 p-2 rounded-lg">
                          <Key className="text-ink" size={24} />
                        </div>
                        <h4 className="text-xl font-bold">1. Authentication (Bring Your Own Key)</h4>
                      </div>
                      <p className="text-ink/80 mb-6 leading-relaxed">To connect through our API, you must supply your own Google Gemini API Key. This ensures you maintain control over your quotas and data privacy. Pass it in the headers.</p>
                      <pre className="bg-[#1a1a1a] text-[#e5e5e5] p-5 rounded-xl overflow-x-auto text-sm font-mono shadow-inner border border-black/20"><code>{`Authorization: Bearer YOUR_API_KEY
X-Legal-Model: gemini-1.5-flash`}</code></pre>
                    </div>
                    <div className="bg-white p-8 rounded-2xl border border-ink/10 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-ink/5 p-2 rounded-lg">
                          <FilePlus className="text-ink" size={24} />
                        </div>
                        <h4 className="text-xl font-bold">2. Upload & Scan Endpoint</h4>
                      </div>
                      <p className="text-ink/80 mb-6 leading-relaxed">Submit a PDF for automated clause-level risk extraction and inconsistency detection.</p>
                      <pre className="bg-[#1a1a1a] text-[#e5e5e5] p-5 rounded-xl overflow-x-auto text-sm font-mono shadow-inner border border-black/20"><code>{`POST /api/v1/scan
Content-Type: multipart/form-data

{
  "file": "<binary_pdf_data>"
}`}</code></pre>
                    </div>
                  </div>
                </div>
              )}

              {activeModal === "LOGIN" && (
                <div className="flex flex-col items-center justify-center flex-1 text-center py-20">
                  <div className="relative mb-16">
                    <div className="absolute inset-0 bg-ink rounded-full animate-ping opacity-10 scale-150 duration-1000"></div>
                    <div className="absolute inset-0 bg-citation rounded-full animate-pulse opacity-20 scale-125"></div>
                    <div className="bg-ink text-paper p-10 rounded-full shadow-2xl relative z-10 transform hover:rotate-12 transition-transform duration-500">
                      <Scale size={80} className="animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-5xl md:text-6xl font-black text-ink mb-8 tracking-tight">Legal AI Workspace</h3>
                  <div className="bg-citation/20 text-ink px-8 py-3 rounded-full text-xl font-black tracking-widest uppercase mb-8 shadow-sm">
                    Coming Soon
                  </div>
                  <p className="text-2xl text-ink/60 font-medium max-w-2xl mx-auto leading-relaxed">
                    We are finalizing our platform for public release. Please check back shortly for access.
                  </p>
                  <button onClick={closeModal} className="mt-16 px-10 py-5 bg-ink text-paper font-bold rounded-2xl hover:bg-ink/90 transition-transform hover:scale-105 shadow-2xl text-xl">
                    Return to Platform
                  </button>
                </div>
              )}
            </div>
          </div>
      )}
    </div>
    </>
  );
}

