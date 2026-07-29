import { useState, useEffect } from 'react';
import { Trash2, AlertCircle, RefreshCw, Wallet, Scale } from 'lucide-react';
import { cn } from './utils';

type Transaction = {
  id: string;
  desc: string;
  amount: number;
  paidBy: 'A' | 'B';
  date: number;
};

export default function App() {
  const [partnerA, setPartnerA] = useState(() => localStorage.getItem('partnerA') || 'You');
  const [partnerB, setPartnerB] = useState(() => localStorage.getItem('partnerB') || 'Partner');
  const [threshold, setThreshold] = useState(() => Number(localStorage.getItem('threshold')) || 100);
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    localStorage.setItem('partnerA', partnerA);
    localStorage.setItem('partnerB', partnerB);
    localStorage.setItem('threshold', threshold.toString());
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [partnerA, partnerB, threshold, transactions]);

  const netBalance = transactions.reduce((acc, tx) => {
    return acc + (tx.paidBy === 'A' ? tx.amount / 2 : -tx.amount / 2);
  }, 0);

  const isBreakerActive = Math.abs(netBalance) >= threshold;

  const handleAdd = (paidBy: 'A' | 'B') => {
    if (!desc || !amount || isNaN(Number(amount))) return;
    const tx: Transaction = {
      id: crypto.randomUUID(),
      desc,
      amount: Number(amount),
      paidBy,
      date: Date.now(),
    };
    setTransactions([tx, ...transactions]);
    setDesc('');
    setAmount('');
  };

  const handleDelete = (id: string) => {
    setTransactions(transactions.filter((tx) => tx.id !== id));
  };

  const handleSettle = () => {
    if (netBalance === 0) return;
    const settleTx: Transaction = {
      id: crypto.randomUUID(),
      desc: 'Settlement',
      amount: Math.abs(netBalance) * 2,
      paidBy: netBalance > 0 ? 'B' : 'A',
      date: Date.now(),
    };
    setTransactions([settleTx, ...transactions]);
  };

  const maxScale = Math.max(threshold, Math.abs(netBalance) + 10);
  const percentage = 50 + (netBalance / maxScale) * 50;
  
  let bannerText = "All settled up!";
  if (netBalance > 0) {
    bannerText = `${partnerB} owes ${partnerA} $${netBalance.toFixed(2)} - ${partnerB} buys next`;
  } else if (netBalance < 0) {
    bannerText = `${partnerA} owes ${partnerB} $${Math.abs(netBalance).toFixed(2)} - ${partnerA} buys next`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex justify-center selection:bg-indigo-500/30">
      <div className="w-full max-w-2xl space-y-6">
        
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
              <Scale className="w-6 h-6" /> DuoTab
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Threshold $</span>
              <input 
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-20 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner A</label>
              <input 
                value={partnerA}
                onChange={(e) => setPartnerA(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 uppercase font-semibold mb-1 block">Partner B</label>
              <input 
                value={partnerB}
                onChange={(e) => setPartnerB(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl text-center relative overflow-hidden">
          <h2 className="text-lg font-medium mb-2">{bannerText}</h2>
          
          <div className="relative h-4 bg-zinc-800 rounded-full mt-6 mb-2 overflow-hidden flex">
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

        {isBreakerActive && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <p className="text-red-400 font-medium text-sm">Settlement threshold reached!</p>
            </div>
            <button 
              onClick={handleSettle}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Settle Up ($0)
            </button>
          </div>
        )}

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Log Expense</h3>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input 
              placeholder="What was it for?" 
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all"
            />
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500">$</span>
              <input 
                type="number"
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full sm:w-32 bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-4 py-2 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 outline-none transition-all"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => handleAdd('A')}
              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Paid by {partnerA}
            </button>
            <button 
              onClick={() => handleAdd('B')}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4" /> Paid by {partnerB}
            </button>
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-xl flex-1">
          <h3 className="text-sm font-semibold text-zinc-400 mb-4 uppercase tracking-wider">Recent Activity</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {transactions.length === 0 ? (
              <p className="text-zinc-600 text-center py-8 text-sm">No expenses logged yet.</p>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                      tx.paidBy === 'A' ? "bg-indigo-500/20 text-indigo-400" : "bg-rose-500/20 text-rose-400"
                    )}>
                      {tx.paidBy === 'A' ? partnerA[0] : partnerB[0]}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200">{tx.desc}</p>
                      <p className="text-xs text-zinc-500">{new Date(tx.date).toLocaleDateString()} • {tx.paidBy === 'A' ? partnerA : partnerB} paid</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-zinc-300">${tx.amount.toFixed(2)}</span>
                    <button 
                      onClick={() => handleDelete(tx.id)}
                      className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
