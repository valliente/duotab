import { useState, useEffect, useMemo, useRef } from 'react';
import { Trash2, AlertCircle, RefreshCw, Wallet, Scale, Download, Upload, Save, CheckCircle, Undo2, LayoutList, Search, Image as ImageIcon, X, Printer, Moon, Sun, Monitor, Zap, BarChart2, QrCode, CheckSquare } from 'lucide-react';
import { cn } from './utils';

type Transaction = {
  id: string;
  desc: string;
  amount: number;
  paidBy: 'A' | 'B';
  category: string;
  date: string; 
  splitRatio?: number;
  tags?: string[];
};

type UndoAction = {
  transactions: Transaction[];
  message: string;
};

type Theme = 'light' | 'dark' | 'system';

const CATEGORIES = ["Groceries", "Dining", "Bills", "Travel", "Entertainment", "Other"];

const formatCurrency = (val: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

export default function App() {
  const [partnerA, setPartnerA] = useState(() => localStorage.getItem('partnerA') || 'You');
  const [partnerB, setPartnerB] = useState(() => localStorage.getItem('partnerB') || 'Partner');
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('threshold')) || 100);
  const [isCompact, setIsCompact] = useState(() => localStorage.getItem('isCompact') === 'true');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'dark');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [venmoHandle, setVenmoHandle] = useState(() => localStorage.getItem('venmoHandle') || '');
  const [settleQRUrl, setSettleQRUrl] = useState<string | null>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as any[];
      return parsed.map(t => ({
        ...t,
        date: typeof t.date === 'number' ? new Date(t.date).toISOString() : t.date
      }));
    } catch {
      return [];
    }
  });

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Other');
  const [tags, setTags] = useState<string[]>([]);
  const [txSplitPreset, setTxSplitPreset] = useState("50");
  const [txCustomSplit, setTxCustomSplit] = useState(50);
  
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

  const descInputRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ledgerContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    localStorage.setItem('theme', theme);
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('partnerA', partnerA);
    localStorage.setItem('partnerB', partnerB);
    localStorage.setItem('threshold', threshold.toString());
    localStorage.setItem('isCompact', isCompact.toString());
    localStorage.setItem('venmoHandle', venmoHandle);
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [partnerA, partnerB, threshold, isCompact, venmoHandle, transactions]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        const backupsStr = localStorage.getItem('rolling_backups');
        let backups = backupsStr ? JSON.parse(backupsStr) : [];
        const snapshot = {
          timestamp: new Date().toISOString(),
          state: { partnerA, partnerB, threshold, transactions }
        };
        if (backups.length > 0 && JSON.stringify(backups[0].state) === JSON.stringify(snapshot.state)) {
          return;
        }
        backups = [snapshot, ...backups].slice(0, 5); 
        localStorage.setItem('rolling_backups', JSON.stringify(backups));
      } catch (e) {
        console.error("Backup failed", e);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [transactions, partnerA, partnerB, threshold]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        descInputRef.current?.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        // Only select all if focus is not in an input
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const allIds = filteredTransactions.map(tx => tx.id);
          if (selectedTxIds.size === allIds.length && allIds.length > 0) {
            setSelectedTxIds(new Set()); // toggle off
          } else {
            setSelectedTxIds(new Set(allIds));
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTransactions, selectedTxIds]); // Need dependencies for correct state reading inside event

  useEffect(() => {
    if (receiptFile) {
      const url = URL.createObjectURL(receiptFile);
      setReceiptUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setReceiptUrl(null);
    }
  }, [receiptFile]);

  const netBalance = useMemo(() => {
    let latestSettlementIndex = -1;
    for (let i = 0; i < transactions.length; i++) {
      if (transactions[i].category === 'Settlement') {
        latestSettlementIndex = i;
        break;
      }
    }
    const activeTransactions = latestSettlementIndex !== -1 ? transactions.slice(0, latestSettlementIndex) : transactions;
    const rawBalance = activeTransactions.reduce((acc, tx) => {
      const ratioA = tx.splitRatio ?? 50;
      const val = tx.paidBy === 'A' ? tx.amount * ((100 - ratioA) / 100) : -tx.amount * (ratioA / 100);
      return acc + val;
    }, 0);
    return Math.round((rawBalance + Number.EPSILON) * 100) / 100;
  }, [transactions]);

  const activeLedger = useMemo(() => {
    const idx = transactions.findIndex(t => t.category === 'Settlement');
    return idx !== -1 ? transactions.slice(0, idx) : transactions;
  }, [transactions]);

  const maxScale = useMemo(() => Math.max(threshold, Math.abs(netBalance) + 10), [threshold, netBalance]);
  
  const monthlyAnalytics = useMemo(() => {
    if (!showAnalytics) return null;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    let currTotal = 0;
    let prevTotal = 0;
    const currCatMap: Record<string, number> = {};
    const prevCatMap: Record<string, number> = {};

    transactions.forEach(tx => {
      if (tx.category === 'Settlement') return;
      const d = new Date(tx.date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        currTotal += tx.amount;
        currCatMap[tx.category] = (currCatMap[tx.category] || 0) + tx.amount;
      } else if (d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth) {
        prevTotal += tx.amount;
        prevCatMap[tx.category] = (prevCatMap[tx.category] || 0) + tx.amount;
      }
    });
    
    const maxVal = Math.max(currTotal, prevTotal, 1);
    
    return { currTotal, prevTotal, currCatMap, prevCatMap, maxVal, currentMonth, lastMonth };
  }, [transactions, showAnalytics]);

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
      const match = file.name.match(/[\d]+[.,][\d]{2}/);
      if (match) setAmount(match[0].replace(',', '.'));
      const nameParts = file.name.split('.')[0].replace(/[-_]/g, ' ');
      if (nameParts && !desc) setDesc(nameParts);
    }
  };

  const handleAdd = (paidBy: 'A' | 'B') => {
    if (isProcessing) return;
    const numAmount = Number(amount);
    if (!desc.trim()) { setError('Description cannot be empty'); return; }
    if (!amount || isNaN(numAmount) || numAmount <= 0) { setError('Amount must be greater than $0'); return; }
    setError('');
    setIsProcessing(true);

    saveUndoSnapshot(`Added ${desc.trim()}`);
    let ratioA = txSplitPreset === 'custom' ? txCustomSplit : Number(txSplitPreset);

    const tx: Transaction = {
      id: crypto.randomUUID(),
      desc: desc.trim(),
      amount: Math.round((numAmount + Number.EPSILON) * 100) / 100,
      paidBy,
      category,
      date: new Date().toISOString(),
      splitRatio: ratioA
    };
    
    setTransactions([tx, ...transactions]);
    setDesc('');
    setAmount('');
    setReceiptFile(null);
    setIsProcessing(false);
    
    if (isBatchMode) {
      setTimeout(() => descInputRef.current?.focus(), 10);
    }
  };

  const handleDelete = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      saveUndoSnapshot(`Deleted ${tx.desc}`);
      setTransactions(transactions.filter((t) => t.id !== id));
      setSelectedTxIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleBatchDelete = () => {
    if (selectedTxIds.size === 0) return;
    saveUndoSnapshot(`Deleted ${selectedTxIds.size} transactions`);
    setTransactions(transactions.filter(t => !selectedTxIds.has(t.id)));
    setSelectedTxIds(new Set());
  };

  const handleBatchCategorize = (newCategory: string) => {
    if (selectedTxIds.size === 0) return;
    saveUndoSnapshot(`Categorized ${selectedTxIds.size} transactions as ${newCategory}`);
    setTransactions(transactions.map(t => selectedTxIds.has(t.id) ? { ...t, category: newCategory } : t));
    setSelectedTxIds(new Set());
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
      date: new Date().toISOString(),
      splitRatio: 50
    };
    setTransactions([settleTx, ...transactions]);

    if (venmoHandle) {
      // Create deep link for QR code
      const url = `venmo://paycharge?txn=pay&recipients=${venmoHandle}&amount=${Math.abs(netBalance)}&note=DuoTab+Settlement`;
      setSettleQRUrl(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`);
    }
  };

  const handleExportCSV = (specificTxIds?: Set<string>) => {
    const header = "Date,Description,Amount,Category,Paid By,Split A %\n";
    const toExport = specificTxIds 
      ? transactions.filter(t => specificTxIds.has(t.id)) 
      : transactions;
      
    let total = 0;
    const rows = toExport.map(tx => {
      if (tx.category !== 'Settlement') total += tx.amount;
      const dateStr = new Date(tx.date).toLocaleDateString();
      const payer = tx.paidBy === 'A' ? partnerA : partnerB;
      return `"${dateStr}","${tx.desc.replace(/"/g, '""')}","${tx.amount.toFixed(2)}","${tx.category}","${payer}","${tx.splitRatio ?? 50}"`;
    });
    rows.push(`"","Total","${total.toFixed(2)}","","",""`);
    
    const blob = new Blob([header + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
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
        if (!state.transactions || !Array.isArray(state.transactions)) {
          throw new Error("Invalid schema: missing transactions array.");
        }
        if (state.transactions.length > 0 && typeof state.transactions[0].amount !== 'number') {
          throw new Error("Invalid schema: invalid transaction shape.");
        }
        if (window.confirm("Are you sure you want to restore from this backup? This will overwrite all current data.")) {
          setTransactions(state.transactions);
          if (state.partnerA) setPartnerA(state.partnerA);
          if (state.partnerB) setPartnerB(state.partnerB);
          if (state.threshold) setThreshold(state.threshold);
        }
      } catch (err: any) {
        alert("Invalid backup file: " + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreAutoBackup = () => {
    try {
      const backupsStr = localStorage.getItem('rolling_backups');
      if (!backupsStr) return alert("No auto-backups found.");
      const backups = JSON.parse(backupsStr);
      if (backups.length === 0) return alert("No auto-backups found.");
      
      const options = backups.map((b: any, i: number) => `${i + 1}: ${new Date(b.timestamp).toLocaleString()}`).join('\n');
      const choice = window.prompt(`Select a backup to restore (1-${backups.length}):\n${options}`, '1');
      if (!choice) return;
      const index = parseInt(choice) - 1;
      if (index >= 0 && index < backups.length) {
        const state = backups[index].state;
        if (window.confirm("Overwrite current data with this snapshot?")) {
          if (state.transactions) setTransactions(state.transactions);
          if (state.partnerA) setPartnerA(state.partnerA);
          if (state.partnerB) setPartnerB(state.partnerB);
          if (state.threshold) setThreshold(state.threshold);
        }
      }
    } catch {
      alert("Error reading backups.");
    }
  };

  const toggleSelectTx = (id: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const percentage = 50 + (netBalance / maxScale) * 50;
  
  let bannerText = "All settled up!";
  if (netBalance > 0) {
    bannerText = `${partnerB} owes ${partnerA} ${formatCurrency(netBalance)}`;
  } else if (netBalance < 0) {
    bannerText = `${partnerA} owes ${partnerB} ${formatCurrency(Math.abs(netBalance))}`;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <>
    {/* Screen Layout */}
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 flex justify-center selection:bg-indigo-500/30 font-sans relative pb-24 print:hidden transition-colors duration-300">
      <div className="w-full max-w-2xl space-y-6 relative">
        
        {/* Header & Settings */}
        <div className="bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 backdrop-blur-sm shadow-xl transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
              <Scale className="w-6 h-6" /> DuoTab
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              {/* Theme Switcher */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-1 rounded-lg">
                <button onClick={() => setTheme('light')} className={cn("p-1.5 rounded-md transition-colors", theme === 'light' ? "bg-white dark:bg-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300")} title="Light Mode"><Sun className="w-4 h-4" /></button>
                <button onClick={() => setTheme('dark')} className={cn("p-1.5 rounded-md transition-colors", theme === 'dark' ? "bg-white dark:bg-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300")} title="Dark Mode"><Moon className="w-4 h-4" /></button>
                <button onClick={() => setTheme('system')} className={cn("p-1.5 rounded-md transition-colors", theme === 'system' ? "bg-white dark:bg-zinc-800 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300")} title="System Theme"><Monitor className="w-4 h-4" /></button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Threshold $</span>
                <input 
                  type="number" value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-20 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-700 pl-3">
                <button onClick={handleRestoreAutoBackup} className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Restore Auto-Backup"><Undo2 className="w-4 h-4" /></button>
                <button onClick={handleBackup} className="text-zinc-500 dark:text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 p-1.5 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Backup Data to JSON"><Save className="w-4 h-4" /></button>
                <button onClick={() => fileInputRef.current?.click()} className="text-zinc-500 dark:text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg transition-colors bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800" title="Restore Data from JSON"><Upload className="w-4 h-4" /></button>
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleRestore} className="hidden" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner A</label>
              <input value={partnerA} onChange={(e) => setPartnerA(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner B</label>
              <input value={partnerB} onChange={(e) => setPartnerB(e.target.value)} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all" />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 flex items-center gap-1">Venmo / CashApp Receiver Handle <QrCode className="w-3.5 h-3.5"/></label>
            <input placeholder="@username" value={venmoHandle} onChange={(e) => setVenmoHandle(e.target.value)} className="w-full sm:w-1/2 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all" />
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Tug of War Scale */}
          <div className="bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden flex-1 flex flex-col justify-center transition-colors">
            <h2 className="text-lg font-medium mb-2">{bannerText}</h2>
            {netBalance !== 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">{netBalance > 0 ? partnerB : partnerA} buys next</p>
            )}
            
            <div className="relative h-4 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-4 mb-2 overflow-hidden flex">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-zinc-400 dark:bg-zinc-700 z-10" />
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
              "bg-white/50 dark:bg-zinc-900/50 border rounded-2xl p-5 shadow-xl md:w-80 flex-shrink-0 transition-colors duration-300 relative",
              isDragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/5" : "border-zinc-200 dark:border-zinc-800"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm rounded-2xl border-2 border-dashed border-indigo-500">
                <p className="text-indigo-500 dark:text-indigo-400 font-medium animate-pulse flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" /> Drop Receipt Here
                </p>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                Log Expense
                <button onClick={() => setIsBatchMode(!isBatchMode)} className={cn("p-1 rounded transition-colors flex items-center gap-1", isBatchMode ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")} title="Batch Mode (Keeps Focus)"><Zap className="w-3.5 h-3.5" /></button>
              </h3>
              {receiptUrl && (
                <div className="relative group">
                  <img src={receiptUrl} alt="Receipt" className="w-8 h-8 rounded object-cover border border-zinc-300 dark:border-zinc-700 opacity-90 dark:opacity-80" />
                  <button onClick={() => setReceiptFile(null)} className="absolute -top-1.5 -right-1.5 bg-zinc-800 hover:bg-rose-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
            
            {error && (
              <div className="mb-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-sm flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <input ref={descInputRef} placeholder="What was it for?" value={desc} onChange={(e) => { setDesc(e.target.value); setError(''); }} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-zinc-400 dark:text-zinc-500">$</span>
                  <input type="number" placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value); setError(''); }} className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all" />
                </div>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-28 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all text-zinc-700 dark:text-zinc-300">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-950/50 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800/50">
                <span className="text-xs text-zinc-500 font-medium">Split:</span>
                <select value={txSplitPreset} onChange={(e) => setTxSplitPreset(e.target.value)} className="flex-1 bg-transparent text-xs text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer">
                  <option value="50">50/50 Equal</option>
                  <option value="60">60/40 ({partnerA} 60%)</option>
                  <option value="70">70/30 ({partnerA} 70%)</option>
                  <option value="100">100% Single</option>
                  <option value="0">0% ({partnerB} 100%)</option>
                  <option value="custom">Custom %</option>
                </select>
                {txSplitPreset === 'custom' && (
                  <input type="number" min="0" max="100" value={txCustomSplit} onChange={(e) => setTxCustomSplit(Math.min(100, Math.max(0, Number(e.target.value))))} className="w-12 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded px-1 py-0.5 text-xs text-center" title={`${partnerA}'s %`} />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleAdd('A')} disabled={isProcessing} className="bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Wallet className="w-3.5 h-3.5" /> {partnerA}</button>
              <button onClick={() => handleAdd('B')} disabled={isProcessing} className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"><Wallet className="w-3.5 h-3.5" /> {partnerB}</button>
            </div>
          </div>
        </div>

        {/* Analytics Panel */}
        {showAnalytics && monthlyAnalytics && (
          <div className="bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl animate-in fade-in slide-in-from-top-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Month-over-Month Analytics</h3>
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-indigo-500"></div> {monthNames[monthlyAnalytics.currentMonth]} ({formatCurrency(monthlyAnalytics.currTotal)})</span>
                <span className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-zinc-400 dark:bg-zinc-600"></div> {monthNames[monthlyAnalytics.lastMonth]} ({formatCurrency(monthlyAnalytics.prevTotal)})</span>
              </div>
            </div>
            <div className="space-y-4">
              {CATEGORIES.map(cat => {
                const cVal = monthlyAnalytics.currCatMap[cat] || 0;
                const pVal = monthlyAnalytics.prevCatMap[cat] || 0;
                if (cVal === 0 && pVal === 0) return null;
                const cWidth = `${Math.max((cVal / monthlyAnalytics.maxVal) * 100, 1)}%`;
                const pWidth = `${Math.max((pVal / monthlyAnalytics.maxVal) * 100, 1)}%`;
                return (
                  <div key={cat} className="flex items-center gap-4 text-sm">
                    <div className="w-24 text-right text-zinc-600 dark:text-zinc-400 truncate">{cat}</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-indigo-500 rounded-r transition-all duration-1000 ease-out flex items-center justify-end pr-1" style={{ width: cWidth }}>
                        <span className="text-[10px] text-white font-medium">{cVal > 0 ? formatCurrency(cVal) : ''}</span>
                      </div>
                      <div className="h-2 bg-zinc-300 dark:bg-zinc-700 rounded-r transition-all duration-1000 ease-out" style={{ width: pWidth }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* QR Settlement Modal */}
        {settleQRUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-4 relative animate-in zoom-in-95">
              <button onClick={() => setSettleQRUrl(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"><X className="w-5 h-5"/></button>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Settlement QR</h3>
              <p className="text-sm text-zinc-500">Scan this code with your phone's camera to instantly open Venmo or CashApp and pay the balance.</p>
              <div className="bg-white p-4 rounded-xl inline-block border-2 border-dashed border-zinc-200 mx-auto mt-4">
                <img src={settleQRUrl} alt="Payment QR Code" className="w-40 h-40 mx-auto" />
              </div>
              <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-2">Paying: {venmoHandle}</p>
            </div>
          </div>
        )}

        {/* Circuit Breaker Alert */}
        {isBreakerActive && (
          <div className="bg-red-50 dark:bg-red-500/10 border-2 border-red-200 dark:border-red-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-[0_0_15px_rgba(239,68,68,0.1)] gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 animate-pulse" />
              <p className="text-red-700 dark:text-red-400 font-semibold text-sm">Settlement threshold reached! Time to square up.</p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => window.print()} className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors flex-shrink-0" title="Print Statement"><Printer className="w-4 h-4" /></button>
              <button onClick={handleSettle} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-500/20 flex-shrink-0 w-full sm:w-auto justify-center"><RefreshCw className="w-4 h-4" /> Settle Up ($0)</button>
            </div>
          </div>
        )}

        {/* Ledger & Filters */}
        <div className="bg-white/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col transition-colors">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-3 items-start md:items-center">
            <h3 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-2">
              Activity Ledger
              <button onClick={() => setShowAnalytics(!showAnalytics)} className={cn("p-1 rounded transition-colors", showAnalytics ? "bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300")} title="Monthly Analytics"><BarChart2 className="w-4 h-4" /></button>
            </h3>
            
            <div className="flex flex-wrap items-center gap-2 flex-1 justify-end w-full">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-400 dark:text-zinc-500" />
                <input 
                  type="text" placeholder="Search..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 outline-none text-zinc-800 dark:text-zinc-300"
                />
              </div>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden sm:block"></div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {['All', ...CATEGORIES, 'Settlement'].map(c => (
                  <button key={c} onClick={() => setCategoryFilter(c)} className={cn("px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors", categoryFilter === c ? "bg-zinc-800 dark:bg-zinc-700 text-white font-medium" : "bg-zinc-100 dark:bg-zinc-950/50 text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-300")}>{c}</button>
                ))}
              </div>
              <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden md:block"></div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsCompact(!isCompact)} className={cn("text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 p-1 rounded-md transition-colors", isCompact && "text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/10")} title={isCompact ? "Comfortable View" : "Compact View"}><LayoutList className="w-4 h-4" /></button>
                <button onClick={() => handleExportCSV()} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 p-1 rounded-md transition-colors" title="Export Ledger to CSV"><Download className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar" ref={ledgerContainerRef}>
            {filteredTransactions.length === 0 ? (
              <p className="text-zinc-500 dark:text-zinc-600 text-center py-10 text-sm">No expenses found.</p>
            ) : (
              filteredTransactions.map(tx => (
                <div key={tx.id} className={cn(
                  "flex items-center justify-between rounded-xl border transition-all duration-300 ease-out group animate-in slide-in-from-top-2 fade-in",
                  isCompact ? "p-2" : "p-3",
                  selectedTxIds.has(tx.id) ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 dark:border-indigo-500/50" :
                  tx.category === 'Settlement' ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/40" : "bg-white dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800/50 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button onClick={() => toggleSelectTx(tx.id)} className={cn("flex-shrink-0 transition-colors p-1 rounded", selectedTxIds.has(tx.id) ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-300 dark:text-zinc-700 hover:text-zinc-400")}>
                      <CheckSquare className="w-4 h-4" />
                    </button>
                    <div className={cn("rounded-full flex items-center justify-center font-bold flex-shrink-0 transition-colors", isCompact ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm", tx.category === 'Settlement' ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" : tx.paidBy === 'A' ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" : "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400")}>
                      {tx.category === 'Settlement' ? <CheckCircle className={cn(isCompact ? "w-3 h-3" : "w-4 h-4")} /> : (tx.paidBy === 'A' ? partnerA[0] : partnerB[0])}
                    </div>
                    <div className="min-w-0 pr-4 cursor-pointer" onClick={() => toggleSelectTx(tx.id)}>
                      <p className={cn("font-medium text-zinc-900 dark:text-zinc-200 truncate select-none", isCompact && "text-sm")}>{tx.desc}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5 select-none">
                        <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</span>
                        <span className={cn("text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap border", tx.category === 'Settlement' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20" : "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-transparent")}>{tx.category}</span>
                        {tx.category !== 'Settlement' && <span className="text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap">• {tx.splitRatio ?? 50}/{100 - (tx.splitRatio ?? 50)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-2 flex-shrink-0">
                    <div className="text-right">
                      <div className={cn("font-semibold", tx.category === 'Settlement' ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-300", isCompact && "text-sm")}>{formatCurrency(tx.amount)}</div>
                      {tx.category !== 'Settlement' && <div className="text-[10px] text-zinc-500">{tx.paidBy === 'A' ? partnerA : partnerB} paid</div>}
                    </div>
                    <button onClick={() => handleDelete(tx.id)} className="text-zinc-400 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1" title="Delete transaction"><Trash2 className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Floating Bulk Action Bar */}
      <div className={cn(
        "fixed bottom-24 right-1/2 translate-x-1/2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-200 px-4 py-3 rounded-xl shadow-2xl flex flex-wrap items-center justify-center gap-3 sm:gap-6 transition-all duration-300 z-40",
        selectedTxIds.size > 0 ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      )}>
        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{selectedTxIds.size} Selected</span>
        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 hidden sm:block"></div>
        <select onChange={(e) => { if(e.target.value) handleBatchCategorize(e.target.value); e.target.value = ''; }} className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-xs outline-none">
          <option value="">Categorize as...</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={() => handleExportCSV(selectedTxIds)} className="text-xs font-medium hover:text-indigo-500 transition-colors flex items-center gap-1"><Download className="w-3.5 h-3.5"/> Export</button>
        <button onClick={handleBatchDelete} className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Delete</button>
        <button onClick={() => setSelectedTxIds(new Set())} className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1"><X className="w-4 h-4"/></button>
      </div>

      {/* Undo Toast */}
      <div className={cn(
        "fixed bottom-6 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-6 bg-zinc-900 dark:bg-zinc-800 border border-zinc-700 text-zinc-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-4 transition-all duration-300 z-50",
        undoAction ? "translate-y-0 opacity-100 scale-100" : "translate-y-8 opacity-0 scale-95 pointer-events-none"
      )}>
        <p className="text-sm font-medium">{undoAction?.message}</p>
        <button onClick={handleUndo} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
      </div>

    </div>
    
    {/* Print Layout */}
    <div className="hidden print:block p-8 bg-white text-black font-serif h-screen w-full">
      <div className="border-b-2 border-black pb-4 mb-6">
        <h1 className="text-4xl font-bold mb-2">DuoTab Settlement Statement</h1>
        <p className="text-lg">Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
      </div>
      <div className="mb-8 text-xl font-bold">{bannerText}</div>
      <div className="grid grid-cols-2 gap-8 mb-8 border border-gray-300 p-4">
        <div>
          <h3 className="font-semibold text-gray-500 uppercase text-sm mb-1">Partner A</h3>
          <p className="text-2xl">{partnerA}</p>
        </div>
        <div>
          <h3 className="font-semibold text-gray-500 uppercase text-sm mb-1">Partner B</h3>
          <p className="text-2xl">{partnerB}</p>
        </div>
      </div>
      <h3 className="text-lg font-bold mb-4">Unsettled Ledger Activity</h3>
      <table className="w-full text-left mb-8 border-collapse">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="py-2">Date</th><th className="py-2">Description</th><th className="py-2">Category</th><th className="py-2">Paid By</th><th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {activeLedger.length === 0 ? (
            <tr><td colSpan={5} className="py-4 text-center italic">No unsettled transactions</td></tr>
          ) : (
            activeLedger.map(tx => (
              <tr key={tx.id} className="border-b border-gray-200">
                <td className="py-2">{new Date(tx.date).toLocaleDateString()}</td>
                <td className="py-2">{tx.desc}</td>
                <td className="py-2">{tx.category}</td>
                <td className="py-2">{tx.paidBy === 'A' ? partnerA : partnerB}</td>
                <td className="py-2 text-right">{formatCurrency(tx.amount)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="mt-20 pt-8 border-t border-gray-300">
        <p className="text-center italic mb-16 text-gray-600">By signing below, both parties agree that this settlement is accurate and resolved.</p>
        <div className="flex justify-around">
          <div className="w-64"><div className="border-b border-black h-8 mb-2"></div><p className="text-center font-bold">{partnerA}</p></div>
          <div className="w-64"><div className="border-b border-black h-8 mb-2"></div><p className="text-center font-bold">{partnerB}</p></div>
        </div>
      </div>
    </div>
    </>
  );
}
