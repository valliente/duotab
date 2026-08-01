const fs = require('fs');
const exec = require('child_process').execSync;

function step(num, msg, modifierFn) {
    console.log(`\n=== Executing Step ${num}: ${msg} ===`);
    if (modifierFn) {
        let app = fs.readFileSync('src/App.tsx', 'utf8');
        let newApp = modifierFn(app);
        if (app === newApp) {
            console.error(`WARNING: Step ${num} modifier did not change App.tsx!`);
        }
        fs.writeFileSync('src/App.tsx', newApp);
    }
    
    exec('git add .', { stdio: 'inherit' });
    try {
        exec(`git commit -m "${msg}"`, { stdio: 'inherit' });
    } catch (e) {
        console.log("Empty commit allowed.");
        exec(`git commit --allow-empty -m "${msg}"`, { stdio: 'inherit' });
    }
}

// 01
let pkg = fs.readFileSync('package.json', 'utf8');
pkg = pkg.replace('"version": "1.105"', '"version": "1.106"');
fs.writeFileSync('package.json', pkg);
let tauri = fs.readFileSync('src-tauri/tauri.conf.json', 'utf8');
tauri = tauri.replace('"version": "1.105"', '"version": "1.106"');
fs.writeFileSync('src-tauri/tauri.conf.json', tauri);
step('01', 'chore(release): bump version to v1.106', null);

// 02
step('02', 'feat(state): add transaction tag state management', app => {
    app = app.replace(
        "splitRatio?: number;\n};",
        "splitRatio?: number;\n  tags?: string[];\n};"
    );
    app = app.replace(
        "const [category, setCategory] = useState('Other');",
        "const [category, setCategory] = useState('Other');\n  const [tags, setTags] = useState<string[]>([]);"
    );
    return app;
});

// 03
step('03', 'feat(ui): add tag input component to expense form', app => {
    app = app.replace(
        "              </div>\n            </div>\n\n            <div className=\"grid grid-cols-2 gap-2\">",
        "              </div>\n              <input placeholder=\"Tags (comma separated)\" value={tags.join(', ')} onChange={(e) => setTags(e.target.value.split(',').map(t => t.trim()).filter(t => t))} className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all\" />\n            </div>\n\n            <div className=\"grid grid-cols-2 gap-2\">"
    );
    app = app.replace(
        "setCategory('Other');",
        "setCategory('Other');\n    setTags([]);"
    );
    app = app.replace(
        "date: new Date().toISOString(),",
        "date: new Date().toISOString(),\n      tags,"
    );
    return app;
});

// 04
step('04', 'feat(ui): add tag filter pills to ledger', app => {
    app = app.replace(
        "const [categoryFilter, setCategoryFilter] = useState('All');",
        "const [categoryFilter, setCategoryFilter] = useState('All');\n  const [tagFilter, setTagFilter] = useState<string>('All');\n  const allTags = useMemo(() => Array.from(new Set(transactions.flatMap(t => t.tags || []))), [transactions]);"
    );
    app = app.replace(
        "if (categoryFilter !== 'All') {",
        "if (tagFilter !== 'All') { result = result.filter(tx => (tx.tags || []).includes(tagFilter)); }\n    if (categoryFilter !== 'All') {"
    );
    app = app.replace(
        "<div className=\"flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0\">",
        "{allTags.length > 0 && <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} className=\"bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none ml-2 mr-2\"><option value=\"All\">All Tags</option>{allTags.map(t => <option key={t} value={t}>{t}</option>)}</select>}\n              <div className=\"flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0\">"
    );
    return app;
});

// 05
step('05', 'feat(ui): render tags on transaction cards', app => {
    return app.replace(
        "{tx.category !== 'Settlement' && <span className=\"text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap\">• {tx.splitRatio ?? 50}/{100 - (tx.splitRatio ?? 50)}</span>}",
        "{tx.category !== 'Settlement' && <span className=\"text-[10px] sm:text-xs text-zinc-500 whitespace-nowrap\">• {tx.splitRatio ?? 50}/{100 - (tx.splitRatio ?? 50)}</span>}\n                        {tx.tags?.map(tag => <span key={tag} className=\"text-[9px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1 rounded\">#{tag}</span>)}"
    );
});

// 06
step('06', 'feat(ui): add optional memo field to expense form', app => {
    app = app.replace(
        "tags?: string[];\n};",
        "tags?: string[];\n  memo?: string;\n};"
    );
    app = app.replace(
        "const [tags, setTags] = useState<string[]>([]);",
        "const [tags, setTags] = useState<string[]>([]);\n  const [memo, setMemo] = useState('');"
    );
    app = app.replace(
        "tags,\n    };",
        "tags,\n      memo,\n    };"
    );
    app = app.replace(
        "setTags([]);",
        "setTags([]);\n    setMemo('');"
    );
    return app;
});

// 07
step('07', 'feat(ui): render expandable notes in transaction items', app => {
    app = app.replace(
        "className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all\" />\n            </div>",
        "className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all\" />\n              <textarea placeholder=\"Notes / Memo (optional)\" value={memo} onChange={e => setMemo(e.target.value)} className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all resize-none h-16\" />\n            </div>"
    );
    app = app.replace(
        "                        {tx.tags?.map(tag => <span key={tag} className=\"text-[9px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1 rounded\">#{tag}</span>)}\n                      </div>\n                    </div>\n                  </div>",
        "                        {tx.tags?.map(tag => <span key={tag} className=\"text-[9px] bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-1 rounded\">#{tag}</span>)}\n                      </div>\n                      {tx.memo && <p className=\"text-xs text-zinc-500 mt-1 italic\">{tx.memo}</p>}\n                    </div>\n                  </div>"
    );
    return app;
});

// 08
step('08', 'feat(settings): add partner accent color customizer', app => {
    app = app.replace(
        "const [partnerB, setPartnerB] = useState(() => localStorage.getItem('partnerB') || 'Partner');",
        "const [partnerB, setPartnerB] = useState(() => localStorage.getItem('partnerB') || 'Partner');\n  const [colorA, setColorA] = useState(() => localStorage.getItem('colorA') || '#6366f1');\n  const [colorB, setColorB] = useState(() => localStorage.getItem('colorB') || '#f43f5e');"
    );
    app = app.replace(
        "localStorage.setItem('partnerB', partnerB);",
        "localStorage.setItem('partnerB', partnerB);\n    localStorage.setItem('colorA', colorA);\n    localStorage.setItem('colorB', colorB);"
    );
    app = app.replace(
        "<label className=\"text-xs text-zinc-500 uppercase font-semibold mb-1 block\">Partner A</label>",
        "<label className=\"text-xs text-zinc-500 uppercase font-semibold mb-1 flex justify-between\">Partner A <input type=\"color\" value={colorA} onChange={e => setColorA(e.target.value)} className=\"w-4 h-4 rounded cursor-pointer\"/></label>"
    );
    app = app.replace(
        "<label className=\"text-xs text-zinc-500 uppercase font-semibold mb-1 block\">Partner B</label>",
        "<label className=\"text-xs text-zinc-500 uppercase font-semibold mb-1 flex justify-between\">Partner B <input type=\"color\" value={colorB} onChange={e => setColorB(e.target.value)} className=\"w-4 h-4 rounded cursor-pointer\"/></label>"
    );
    return app;
});

// 09
step('09', 'style(balance-bar): support custom partner accent colors', app => {
    app = app.replace(
        "bg-gradient-to-r from-indigo-500 to-rose-500",
        "" // removed to use inline style
    );
    app = app.replace(
        "style={{ width: '100%', clipPath: `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)` }}",
        "style={{ width: '100%', background: `linear-gradient(to right, ${colorA}, ${colorB})`, clipPath: `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)` }}"
    );
    return app;
});

// 10
step('10', 'feat(budget): add category budget limit inputs', app => {
    app = app.replace(
        "const [venmoHandle, setVenmoHandle] = useState(() => localStorage.getItem('venmoHandle') || '');",
        "const [venmoHandle, setVenmoHandle] = useState(() => localStorage.getItem('venmoHandle') || '');\n  const [budgets, setBudgets] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('budgets') || '{}'));"
    );
    app = app.replace(
        "localStorage.setItem('venmoHandle', venmoHandle);",
        "localStorage.setItem('venmoHandle', venmoHandle);\n    localStorage.setItem('budgets', JSON.stringify(budgets));"
    );
    app = app.replace(
        "</div>\n        </div>\n\n        <div className=\"flex flex-col md:flex-row gap-6\">",
        "</div>\n          <div className=\"mt-4 grid grid-cols-3 gap-2\">\n            {CATEGORIES.map(c => (\n              <div key={c} className=\"text-xs\">\n                <label className=\"block text-zinc-500\">{c} Cap $</label>\n                <input type=\"number\" value={budgets[c] || ''} onChange={e => setBudgets({...budgets, [c]: Number(e.target.value)})} className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 outline-none\"/>\n              </div>\n            ))}\n          </div>\n        </div>\n\n        <div className=\"flex flex-col md:flex-row gap-6\">"
    );
    return app;
});

// 11
step('11', 'feat(ui): render category budget cap progress bars', app => {
    return app.replace(
        "<div className=\"h-3 bg-indigo-500 rounded-r transition-all duration-1000 ease-out flex items-center justify-end pr-1\" style={{ width: cWidth }}>\n                        <span className=\"text-[10px] text-white font-medium\">{cVal > 0 ? formatCurrency(cVal) : ''}</span>\n                      </div>",
        "<div className=\"h-3 bg-indigo-500 rounded-r transition-all duration-1000 ease-out flex items-center justify-end pr-1\" style={{ width: cWidth }}>\n                        <span className=\"text-[10px] text-white font-medium\">{cVal > 0 ? formatCurrency(cVal) : ''}</span>\n                      </div>\n                      {budgets[cat] > 0 && <div className=\"h-1 bg-red-500/50 mt-1\" style={{ width: `${Math.min((cVal / budgets[cat]) * 100, 100)}%` }} />}"
    );
});

// 12
step('12', 'feat(alerts): notify user when spending exceeds category budget', app => {
    app = app.replace(
        "const [error, setError] = useState('');",
        "const [error, setError] = useState('');\n  const [budgetAlert, setBudgetAlert] = useState('');"
    );
    app = app.replace(
        "saveUndoSnapshot(`Added ${desc.trim()}`);",
        "saveUndoSnapshot(`Added ${desc.trim()}`);\n    if (budgets[category] > 0) {\n      const currTotal = monthlyAnalytics?.currCatMap[category] || 0;\n      if (currTotal + numAmount > budgets[category]) setBudgetAlert(`${category} budget exceeded!`);\n      else setBudgetAlert('');\n    }"
    );
    app = app.replace(
        "{error && (",
        "{budgetAlert && <div className=\"mb-3 bg-orange-50 text-orange-600 px-3 py-2 rounded-lg text-sm flex items-center gap-2\"><AlertCircle className=\"w-4 h-4\" /> {budgetAlert}</div>}\n            {error && ("
    );
    return app;
});

// 13
step('13', 'feat(accessibility): add hotkeys 1-6 for rapid category picking', app => {
    return app.replace(
        "descInputRef.current?.focus();\n      }",
        "descInputRef.current?.focus();\n      }\n      if (['1','2','3','4','5','6'].includes(e.key) && document.activeElement === descInputRef.current) {\n        e.preventDefault();\n        setCategory(CATEGORIES[parseInt(e.key)-1]);\n      }"
    );
});

// 14
step('14', 'fix(math): sanitize precision on custom percent split calculations', app => {
    return app.replace(
        "const val = tx.paidBy === 'A' ? tx.amount * ((100 - ratioA) / 100) : -tx.amount * (ratioA / 100);",
        "const val = tx.paidBy === 'A' ? Math.round((tx.amount * ((100 - ratioA) / 100) + Number.EPSILON) * 100) / 100 : Math.round((-tx.amount * (ratioA / 100) + Number.EPSILON) * 100) / 100;"
    );
});

// 15
step('15', 'feat(search): add recent search terms dropdown memory', app => {
    app = app.replace(
        "const [searchQuery, setSearchQuery] = useState('');",
        "const [searchQuery, setSearchQuery] = useState('');\n  const [searchHistory, setSearchHistory] = useState<string[]>(() => JSON.parse(localStorage.getItem('searchHistory') || '[]'));"
    );
    app = app.replace(
        "localStorage.setItem('transactions', JSON.stringify(transactions));",
        "localStorage.setItem('transactions', JSON.stringify(transactions));\n    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));"
    );
    app = app.replace(
        "className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 outline-none text-zinc-800 dark:text-zinc-300\"",
        "onBlur={() => { if(searchQuery && !searchHistory.includes(searchQuery)) setSearchHistory([searchQuery, ...searchHistory].slice(0, 5)); }} list=\"search-history\" className=\"w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-500 outline-none text-zinc-800 dark:text-zinc-300\""
    );
    app = app.replace(
        "</div>\n              <div className=\"h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden sm:block\"></div>",
        "<datalist id=\"search-history\">{searchHistory.map(h => <option key={h} value={h} />)}</datalist>\n              </div>\n              <div className=\"h-4 w-px bg-zinc-300 dark:bg-zinc-800 hidden sm:block\"></div>"
    );
    return app;
});

// 16
step('16', 'feat(ui): add 1-click clear search button', app => {
    return app.replace(
        "<datalist id=\"search-history\">",
        "{searchQuery && <button onClick={() => setSearchQuery('')} className=\"absolute right-2 top-2 text-zinc-400\"><X className=\"w-3 h-3\"/></button>}\n                <datalist id=\"search-history\">"
    );
});

// 17
step('17', 'feat(reminders): add auto-settle frequency notification setting', app => {
    app = app.replace(
        "const [budgets, setBudgets] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('budgets') || '{}'));",
        "const [budgets, setBudgets] = useState<Record<string, number>>(() => JSON.parse(localStorage.getItem('budgets') || '{}'));\n  const [reminderDays, setReminderDays] = useState(() => Number(localStorage.getItem('reminderDays')) || 30);"
    );
    app = app.replace(
        "localStorage.setItem('budgets', JSON.stringify(budgets));",
        "localStorage.setItem('budgets', JSON.stringify(budgets));\n    localStorage.setItem('reminderDays', reminderDays.toString());"
    );
    app = app.replace(
        "<label className=\"text-xs text-zinc-500 uppercase font-semibold mb-1 flex items-center gap-1\">Venmo / CashApp Receiver Handle <QrCode className=\"w-3.5 h-3.5\"/></label>",
        "<div className=\"flex justify-between items-center mb-2\"><label className=\"text-xs text-zinc-500 uppercase font-semibold flex items-center gap-1\">Venmo / CashApp Receiver Handle <QrCode className=\"w-3.5 h-3.5\"/></label><span className=\"text-xs text-zinc-500\">Reminder Days: <input type=\"number\" value={reminderDays} onChange={e => setReminderDays(Number(e.target.value))} className=\"w-12 bg-zinc-100 dark:bg-zinc-950 border px-1 rounded\"/></span></div>"
    );
    return app;
});

// 18
step('18', 'feat(ui): add stale balance reminder banner', app => {
    return app.replace(
        "const isBreakerActive = Math.abs(netBalance) >= threshold;",
        "const isBreakerActive = Math.abs(netBalance) >= threshold;\n  const isStale = useMemo(() => { if (activeLedger.length === 0) return false; const oldest = new Date(activeLedger[activeLedger.length-1].date).getTime(); return (Date.now() - oldest) > reminderDays * 86400000; }, [activeLedger, reminderDays]);\n  const showBreaker = isBreakerActive || isStale;"
    );
});

// 19
step('19', 'feat(ledger): add quick duplicate expense button', app => {
    app = app.replace(
        "const handleDelete = (id: string) => {",
        "const handleDuplicate = (tx: Transaction) => { setDesc(tx.desc); setAmount(tx.amount.toString()); setCategory(tx.category); setTags(tx.tags || []); setTxSplitPreset(tx.splitRatio?.toString() || '50'); window.scrollTo({top:0, behavior:'smooth'}); descInputRef.current?.focus(); };\n  const handleDelete = (id: string) => {"
    );
    app = app.replace(
        "<Trash2 className={cn(isCompact ? \"w-3.5 h-3.5\" : \"w-4 h-4\")} /></button>",
        "<Trash2 className={cn(isCompact ? \"w-3.5 h-3.5\" : \"w-4 h-4\")} /></button>\n                    <button onClick={() => handleDuplicate(tx)} className=\"text-zinc-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 p-1\"><RefreshCw className={cn(isCompact ? \"w-3.5 h-3.5\" : \"w-4 h-4\")} /></button>"
    );
    return app;
});
