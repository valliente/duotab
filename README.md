# DuoTab

> **Shared Expense Ledger & Dual-Party Financial Balancing Workspace**

[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)](https://github.com/valliente/duotab/releases)
[![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-18+-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

DuoTab is a local-first desktop financial balancing application and shared ledger designed for dual-party household management, collaborative budgeting, and expense reconciliation. Built with Tauri v2, React, and TypeScript, it delivers zero-latency local data management with privacy preservation.

---

## Core Features

- **Dual-Party Split Ledger**: Real-time tracking of shared expenditures with attribution to either party.
- **Granular Split Ratios**: Supports standard 50/50 parity or custom proportional equity ratios per transaction.
- **Automated Settlement Reconciliation**: Continuously computes net balance offsets to minimize transfer overhead.
- **Categorization & Analytics**: Real-time spending distributions across customizable categories (*Groceries*, *Dining*, *Utilities*, *Travel*, *Entertainment*).
- **Search & Filter Pipeline**: Multi-attribute filtering across transaction memos, tags, date windows, and payer identity.
- **Export & Portability**: Backup and restore support via structured JSON export, CSV ledger reports, and printable balance summaries.
- **Theme Customization**: Responsive dark, light, and system-adaptive interfaces with personalized partner accent palettes.

---

## Project Structure

```
duotab/
├── src/
│   ├── App.tsx          # Master ledger workspace, analytics, and transaction engine
│   ├── utils.ts         # Formatting and class utility helpers
│   ├── calc.test.ts     # Automated unit tests for balance split math
│   ├── main.tsx         # Client bootstrap
│   └── index.css        # Tailwind styling system
├── src-tauri/
│   ├── src/             # Native Rust backend integration
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri application configuration
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Local Development Setup

### Prerequisites
- Node.js 18+
- Rust & Cargo (for Tauri desktop compilation)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/valliente/duotab.git
cd duotab

# Install dependencies
npm install

# Start Vite web dev server
npm run dev

# Run unit tests
npm test
```

### Compiling Desktop Executable

```bash
# Compile native desktop installer via Tauri
npx tauri build
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.
