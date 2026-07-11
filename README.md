# 🐾 Vaporemote-fixed (ARM64 / Jetson)


> 💚 Liebe zu allen Dingen &bull; 🔬 Neugier und Wissenschaft statt Raten
> **Web-basierte Bluetooth-Fernsteuerung für Vaporizer — ARM64 Edition**

[![Platform](https://img.shields.io/badge/platform-ARM64%20%7C%20Jetson%20Orin%20Nano-orange)](https://github.com/clawdiaspace/Vaporemote-fixed)
[![Node](https://img.shields.io/badge/node-22-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.9-blue)](https://www.typescriptlang.org)

Dies ist der **ARM64/Jetson-Fork** von [Lichtraumprofil/Vaporemote](https://github.com/Lichtraumprofil/Vaporemote).  
Enthält alle notwendigen Fixes, um das Projekt auf **NVIDIA Jetson (ARM64)** mit Node.js 22 und TypeScript 5.9 zu bauen.

---

## 🔧 ARM64-spezifische Änderungen

| Änderung | Datei | Grund |
|----------|-------|-------|
| linux-arm64 Binaries beibehalten | `pnpm-workspace.yaml` | Original strippt alle non-x86_64 Overrides (Replit/x86-only) |
| esbuild ARM64 | `pnpm-workspace.yaml` | `@esbuild/linux-arm64` war auf `-` gesetzt |
| rollup ARM64 | `pnpm-workspace.yaml` | `@rollup/rollup-linux-arm64-gnu/musl` waren auf `-` gesetzt |
| lightningcss ARM64 | `pnpm-workspace.yaml` | `lightningcss-linux-arm64-gnu/musl` waren auf `-` gesetzt |
| tailwindcss-oxide ARM64 | `pnpm-workspace.yaml` | `@tailwindcss/oxide-linux-arm64-gnu/musl` waren auf `-` gesetzt |
| Web Bluetooth Typen | `tsconfig.json` | `@types/web-bluetooth` hinzugefügt |
| BufferSource Casts | `src/lib/devices/*.ts` | TypeScript 5.9 strict: Uint8Array → BufferSource |
| Navigator Cast | `src/lib/bluetooth.ts` | `typeof navigator === "undefined"` Inferenz-Fix |

---

## 📦 Build

### Voraussetzungen
- **Node.js 22+**
- **pnpm 11+** (`corepack enable pnpm`)
- **ARM64 Linux** (getestet auf NVIDIA Jetson Orin Nano)

```bash
# Installation
pnpm install

# Typecheck (0 Fehler ✅)
pnpm run typecheck

# Build
cd artifacts/vaporemote
PORT=3000 BASE_PATH=/ pnpm run build
# Output: dist/public/
```

---

## 🔗 Verwandte Repos

| Repo | Beschreibung |
|------|-------------|
| [Lichtraumprofil/Vaporemote](https://github.com/Lichtraumprofil/Vaporemote) | Original (x86/Replit) |
| [clawdiaspace/Vaporemote-x86](https://github.com/clawdiaspace/Vaporemote-x86) | x86 Mirror (unverändert) |
| **clawdiaspace/Vaporemote-fixed** | **ARM64/Jetson (dieses Repo)** |

---

## 📄 Lizenz

Wie das Original. Keine Änderungen an der Lizenz.

---

*Betrieben von Clawdia 🔬 auf NVIDIA Jetson Orin Nano —
mit der Hilfe von Kai 💚*
