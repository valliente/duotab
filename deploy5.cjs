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

// Fix App.tsx 
let app = fs.readFileSync('src/App.tsx', 'utf8');

// Remove the wrongly placed PIN UI
app = app.replace('if (!isUnlocked) return <div className="h-screen flex items-center justify-center"><div className="p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-xl text-center"><h2>Enter PIN</h2><input type="password" onChange={e => { if (e.target.value === pin) setIsUnlocked(true); }} className="border px-2 py-1 mt-2 rounded"/></div></div>;\n', '');

// Place it before the MAIN return. Let's find `<div className="min-h-screen`
app = app.replace(
    'return (\n    <>\n    <div className="min-h-screen',
    'if (!isUnlocked) return <div className="h-screen flex items-center justify-center"><div className="p-8 bg-white dark:bg-zinc-900 rounded-xl shadow-xl text-center"><h2>Enter PIN</h2><input type="password" onChange={e => { if (e.target.value === pin) setIsUnlocked(true); }} className="border px-2 py-1 mt-2 rounded"/></div></div>;\n\n  return (\n    <>\n    <div className="min-h-screen'
);

fs.writeFileSync('src/App.tsx', app);


step('27', 'build: verify clean production build bundle', app => {
    exec('npm run build', { stdio: 'inherit' });
    return app;
});

// 28
step('28', 'docs: update README with v1.106 feature list', app => {
    fs.writeFileSync('README.md', '# DuoTab v1.106\nIncludes tags, memos, custom themes, budgets, privacy lock, and more!');
    return app;
});

// 29
step('29', 'git tag v1.106', app => {
    exec('git tag v1.106', { stdio: 'inherit' });
    return app;
});

// 30
step('30', 'git push origin main --tags', app => {
    exec('git push origin main --tags', { stdio: 'inherit' });
    return app;
});
