import { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, AlertCircle, RefreshCw, Wallet, Scale, Download, Upload, Save, CheckCircle, Undo2, LayoutList, LayoutTemplate, Search, Image as ImageIcon, X } from 'lucide-react';
import { cn } from './utils';

type Transaction = {
  id: string;
  desc: string;
  amount: number;
  paidBy: 'A' | 'B';
  category: string;
  date: number;
  splitRatio?: number; // Partner A's percentage for this specific transaction
};

type UndoAction = {
  transactions: Transaction[];
  message: string;
};

const CATEGORIES = ["Groceries", "Dining", "Bills", "Travel", "Entertainment", "Other"];

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function App() {
  const [partnerA, setPartnerA] = useState(() => localStorage.getItem('partnerA') || 'You');
  const [partnerB, setPartnerB] = useState(() => localStorage.getItem('partnerB') || 'Partner');
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('threshold')) || 100);
  const [isCompact, setIsCompact] = useState(() => localStorage.getItem('isCompact') === 'true');
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  
  // Per-transaction split state
  const [txSplitPreset, setTxSplitPreset] = useState("50");
  const [txCustomSplit, setTxCustomSplit] = useState(50);
  
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const descInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('partnerA', partnerA);
    localStorage.setItem('partnerB', partnerB);
    localStorage.setItem('threshold', threshold.toString());
    localStorage.setItem('isCompact', isCompact.toString());
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [partnerA, partnerB, threshold, isCompact, transactions]);

  // Clean up blob URLs
  useEffect(() => {
    if (receiptFile) {
      const url = URL.createObjectURL(receiptFile);
      setReceiptUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setReceiptUrl(null);
    }
  }, [receiptFile]);

  // Net Balance calculates from the most recent settlement
  const netBalance = useMemo(() => {
    let latestSettlementIndex = -1;
    for (let i = 0; i < transactions.length; i++) {
      if (transactions[i].category === 'Settlement') {
        latestSettlementIndex = i;
        break;
      }
    }
    
    // Transactions since the last settlement (newest at index 0)
    const activeTransactions = latestSettlementIndex !== -1 
      ? transactions.slice(0, latestSettlementIndex) 
      : transactions;

    const rawBalance = activeTransactions.reduce((acc, tx) => {
      const ratioA = tx.splitRatio ?? 50;
      const val = tx.paidBy === 'A' 
        ? tx.amount * ((100 - ratioA) / 100) 
        : -tx.amount * (ratioA / 100);
      return acc + val;
    }, 0);
    return Math.round((rawBalance + Number.EPSILON) * 100) / 100;
  }, [transactions]);

  const maxScale = useMemo(() => Math.max(threshold, Math.abs(netBalance) + 10), [threshold, netBalance]);
  
  const filteredTransactions = useMemo(() => {
    let result = transactions;
    if (categoryFilter !== 'All') {
      result = result.filter(tx => tx.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      result = result.filter(tx => tx.desc.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [transactions, categoryFilter, searchQuery]);

  const isBreakerActive = Math.abs(netBalance) >= threshold;

  const saveUndoSnapshot = (msg: string) => {
    setUndoAction({ transactions: [...transactions], message: msg });
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => {
      setUndoAction(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (undoAction) {
      setTransactions(undoAction.transactions);
      setUndoAction(null);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      setReceiptFile(file);
      // Mock OCR parsing from file name
      const match = file.name.match(/[\d]+[.,][\d]{2}/);
      if (match) {
        setAmount(match[0].replace(',', '.'));
      }
      const nameParts = file.name.split('.')[0].replace(/[-_]/g, ' ');
      if (nameParts && !desc) {
        setDesc(nameParts);
      }
    }
  };

  const handleAdd = (paidBy: 'A' | 'B') => {
    if (isProcessing) return;
    const numAmount = Number(amount);
    if (!desc.trim()) {
      setError('Description cannot be empty');
      return;
    }
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be greater than $0');
      return;
    }
    setError('');
    setIsProcessing(true);

    saveUndoSnapshot(`Added ${desc.trim()}`);

    let ratioA = 50;
    if (txSplitPreset === 'custom') {
      ratioA = txCustomSplit;
    } else {
      ratioA = Number(txSplitPreset);
    }

    const tx: Transaction = {
      id: crypto.randomUUID(),
      desc: desc.trim(),
      amount: Math.round((numAmount + Number.EPSILON) * 100) / 100,
      paidBy,
      category,
      date: Date.now(),
      splitRatio: ratioA
    };
    
    setTransactions([tx, ...transactions]);
    setDesc('');
    setAmount('');
    setReceiptFile(null);
    setIsProcessing(false);
    
    setTimeout(() => descInputRef.current?.focus(), 10);
  };

  const handleDelete = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      saveUndoSnapshot(`Deleted ${tx.desc}`);
      setTransactions(transactions.filter((t) => t.id !== id));
    }
  };

  const handleSettle = () => {
    if (netBalance === 0) return;
    saveUndoSnapshot(`Settled balance`);
    const settleTx: Transaction = {
      id: crypto.randomUUID(),
      desc: `Settlement Cleared ($0)`,
      amount: Math.abs(netBalance),
      paidBy: netBalance > 0 ? 'B' : 'A',
      category: 'Settlement',
      date: Date.now(),
      splitRatio: 50
    };
    setTransactions([settleTx, ...transactions]);
  };

  const handleExportCSV = () => {
    const header = "Date,Description,Amount,Category,Paid By,Split A %\n";
    const rows = transactions.map(tx => {
      const dateStr = new Date(tx.date).toLocaleDateString();
      const payer = tx.paidBy === 'A' ? partnerA : partnerB;
      return `"${dateStr}","${tx.desc.replace(/"/g, '""')}","${tx.amount.toFixed(2)}","${tx.category}","${payer}","${tx.splitRatio ?? 50}"`;
    }).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `duotab_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackup = () => {
    const state = { partnerA, partnerB, threshold, transactions };
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `duotab_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const state = JSON.parse(event.target?.result as string);
        if (window.confirm("Are you sure you want to restore from this backup? This will overwrite all current data.")) {
          if (state.transactions) setTransactions(state.transactions);
          if (state.partnerA) setPartnerA(state.partnerA);
          if (state.partnerB) setPartnerB(state.partnerB);
          if (state.threshold) setThreshold(state.threshold);
        }
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const percentage = 50 + (netBalance / maxScale) * 50;
  
  let bannerText = "All settled up!";
  if (netBalance > 0) {
    bannerText = `${partnerB} owes ${partnerA} ${formatCurrency(netBalance)}`;
  } else if (netBalance < 0) {
    bannerText = `${partnerA} owes ${partnerB} ${formatCurrency(Math.abs(netBalance))}`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 flex justify-center selection:bg-indigo-500/30 font-sans relative pb-20">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Header & Settings */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
              <Scale className="w-6 h-6" /> DuoTab
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-400">Threshold $</span>
                <input 
                  type="number" value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-1 border-l border-zinc-700 pl-3">
                <button onClick={handleBackup} className="text-zinc-400 hover:text-indigo-400 p-1.5 rounded-lg transition-colors bg-zinc-800/50 hover:bg-zinc-800" title="Backup Data to JSON">
                  <Save className="w-4 h-4" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="text-zinc-400 hover:text-rose-400 p-1.5 rounded-lg transition-colors bg-zinc-800/50 hover:bg-zinc-800" title="Restore Data from JSON">
                  <Upload className="w-4 h-4" />
                </button>
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleRestore} className="hidden" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner A</label>
              <input 
                value={partnerA} onChange={(e) => setPartnerA(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner B</label>
              <input 
                value={partnerB} onChange={(e) => setPartnerB(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Tug of War Scale */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden flex-1 flex flex-col justify-center">
            <h2 className="text-lg font-medium mb-2">{bannerText}</h2>
            {netBalance !== 0 && (
              <p className="text-xs text-zinc-400 mb-2">{netBalance > 0 ? partnerB : partnerA} buys next</p>
            )}
            
            <div className="relative h-4 bg-zinc-800 rounded-full mt-4 mb-2 overflow-hidden flex">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-700 z-10" />
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 transition-all duration-700 ease-out"
                style={{ width: '100%', clipPath: `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500 font-medium">
              <span>{partnerA}</span>
              <span>{partnerB}</span>
            </div>
          </div>

          {/* Quick Add Form with Drag & Drop */}
          <div 
            className={cn(
              "bg-zinc-900/50 border rounded-2xl p-5 shadow-xl md:w-80 flex-shrink-0 transition-colors duration-300 relative",
              isDragging ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-2xl border-2 border-dashed border-indigo-500">
                <p className="text-indigo-400 font-medium animate-pulse flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" /> Drop Receipt Here
                </p>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Log Expense</h3>
              {receiptUrl && (
                <div className="relative group">
                  <img src={receiptUrl} alt="Receipt" className="w-8 h-8 rounded object-cover border border-zinc-700 opacity-80" />
                  <button 
                    onClick={() => setReceiptFile(null)}
                    className="absolute -top-1.5 -right-1.5 bg-zinc-800 hover:bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            
            {error && (
              <div className="mb-3 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <input 
                ref={descInputRef}
                placeholder="What was it for?" 
                value={desc}
                onChange={(e) => { setDesc(e.target.value); setError(''); }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-zinc-500">$</span>
                  <input 
                    type="number" placeholder="0.00" value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(''); }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-2 text-sm focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all text-zinc-300"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Split Selector */}
              <div className="flex items-center gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                <span className="text-xs text-zinc-500 font-medium">Split:</span>
                <select 
                  value={txSplitPreset}
                  onChange={(e) => setTxSplitPreset(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-zinc-300 outline-none cursor-pointer"
                >
                  <option value="50">50/50 Equal</option>
                  <option value="60">60/40 ({partnerA} 60%)</option>
                  <option value="70">70/30 ({partnerA} 70%)</option>
                  <option value="100">100% Single</option>
                  <option value="0">0% ({partnerB} 100%)</option>
                  <option value="custom">Custom %</option>
                </select>
                {txSplitPreset === 'custom' && (
                  <input 
                    type="number" min="0" max="100" 
                    value={txCustomSplit}
                    onChange={(e) => setTxCustomSplit(Math.min(100, Math.max(0, Number(e.target.value))))}
                    className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-xs text-center"
                    title={`${partnerA}'s %`}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleAdd('A')} disabled={isProcessing}
                className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="w-3.5 h-3.5" /> {partnerA}
              </button>
              <button 
                onClick={() => handleAdd('B')} disabled={isProcessing}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wallet className="w-3.5 h-3.5" /> {partnerB}
              </button>
            </div>
          </div>
        </div>

        {/* Circuit Breaker Alert */}
        {isBreakerActive && (
          <div className="bg-red-500/10 border-2 border-red-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.2)] gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
              <p className="text-red-400 font-semibold text-sm">Settlement threshold reached! Time to square up.</p>
            </div>
            <button 
              onClick={handleSettle}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20 flex-shrink-0 w-full sm:w-auto justify-center"
            >
              <RefreshCw className="w-4 h-4" /> Settle Up ($0)
            </button>
          </div>
        )}

        {/* Ledger & Filters */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-3 items-start md:items-center">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">Activity Ledger</h3>
            
            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end w-full">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
                <input 
                  type="text" placeholder="Search..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-zinc-500 outline-none text-zinc-300"
                />
              </div>
              
              <div className="h-4 w-px bg-zinc-800 hidden sm:block"></div>
              
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {['All', ...CATEGORIES, 'Settlement'].map(c => (
                  <button 
                    key={c} onClick={() => setCategoryFilter(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors",
                      categoryFilter === c ? "bg-zinc-700 text-white font-medium" : "bg-zinc-950/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="h-4 w-px bg-zinc-800 hidden md:block"></div>
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsCompact(!isCompact)}
                  className={cn("text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors", isCompact && "text-indigo-400 bg-indigo-500/10")}
                  title={isCompact ? "Comfortable View" : "Compact View"}
                >
                  {isCompact ? <LayoutList className="w-4 h-4" /> : <LayoutTemplate className="w-4 h-4" />}
                </button>
                <button onClick={handleExportCSV} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredTransactions.length === 0 ? (
              <p className="text-zinc-600 text-center py-10 text-sm">No expenses found.</p>
            ) : (
              filteredTransactions.map(tx => (
                <div key={tx.id} className={cn(
                  "flex items-center justify-between rounded-xl border transition-all duration-300 ease-out group animate-in slide-in-from-top-2 fade-in",
                  isCompact ? "p-2" : "p-3",
                  tx.category === 'Settlement' 
                    ? "bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500/60 shadow-[inset_0_0_25px_rgba(16,185,129,0.1)]" 
                    : "bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900"
                )}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "rounded-full flex items-center justify-center font-bold flex-shrink-0 transition-colors",
                      isCompact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
                      tx.category === 'Settlement' ? "bg-emerald-500/20 text-emerald-400" :
                      tx.paidBy === 'A' ? "bg-indigo-500/20 text-indigo-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {tx.category === 'Settlement' ? <CheckCircle className={cn(isCompact ? "w-3 h-3" : "w-4 h-4")} /> : (tx.paidBy === 'A' ? partnerA[0] : partnerB[0])}
                    </div>
                    <div className="min-w-0 pr-4">
                      <p className={cn("font-medium text-zinc-200 truncate", isCompact && "text-sm")}>{tx.desc}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</span>
                        <span className={cn(
                          "text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap",
                          tx.category === 'Settlement' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-400"
                        )}>{tx.category}</span>
                        {tx.category !== 'Settlement' && (
                          <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap">
                            • {tx.splitRatio ?? 50}/{100 - (tx.splitRatio ?? 50)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-2 flex-shrink-0">
                    <div className="text-right">
                      <div className={cn("font-semibold", tx.category === 'Settlement' ? "text-emerald-400" : "text-zinc-300", isCompact && "text-sm")}>
                        {formatCurrency(tx.amount)}
                      </div>
                      {tx.category !== 'Settlement' && (
                        <div className="text-[10px] text-zinc-500">
                          {tx.paidBy === 'A' ? partnerA : partnerB} paid
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDelete(tx.id)}
                      className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Delete transaction"
                    >
                      <Trash2 className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Undo Toast */}
      <div className={cn(
        "fixed bottom-6 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-6 bg-zinc-800 border border-zinc-700 text-zinc-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 transition-all duration-300 z-50",
        undoAction ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      )}>
        <p className="text-sm font-medium">{undoAction?.message}</p>
        <button 
          onClick={handleUndo}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
      </div>

    </div>
  );
}
