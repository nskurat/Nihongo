# Nihongo — Japanese Study Portal 🇯🇵

An interactive Japanese study hub for **Minna no Nihongo** (JLPT N3/N4 Level), featuring interactive grammar reference guides, structural formula breakdowns, nuance explanations, and AI-assisted dynamic example generation.

---

## 🏗️ Project Architecture

This repository uses a modular multi-app architecture. Source code for interactive sub-applications lives in dedicated directories (e.g., `grammar-app/`), while build outputs are centralized into a single, git-ignored `dist/` folder for serving and automated deployment.

```
Nihongo/
├── index.html                   # Main Study Portal landing page
├── package.json                 # Root build & serve scripts
├── .gitignore                   # Ignores build output (dist/) & node_modules
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions workflow for auto-deployment
├── grammar-app/                 # Interactive Grammar Database app (React + Vite + Tailwind)
│   ├── src/                     # React components & UI logic
│   ├── vite.config.js           # Single-file bundler (outputs to ../dist/grammar)
│   └── package.json
└── dist/                        # Centralized build output (Git-ignored)
    ├── index.html               # Main Portal landing page copy
    └── grammar/
        └── index.html           # Compiled standalone Grammar Application
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18 or higher
- **npm**: v9 or higher

### Installation
Install dependencies for both the root workspace and sub-applications:

```bash
# Install root dependencies
npm install

# Install sub-app dependencies
cd grammar-app && npm install && cd ..
```

---

## 🛠️ Development & Local Testing

### 1. Test the Built Site Locally (Recommended)
To build all sub-applications into the central `dist/` folder and launch a local web server:

```bash
# Build the complete site into dist/
npm run build

# Serve the dist/ directory locally
npm run serve
```
Then open **`http://localhost:3000`** in your browser. Clicking **Grammar Database** will load the compiled sub-app seamlessly.

### 2. Live Sub-App Development (Hot Reloading)
To work on `grammar-app` with instant feedback and hot-reloading:

```bash
cd grammar-app
npm run dev
```
Open **`http://localhost:5173`** to access the Vite dev server.

---

## 🌐 Deployment (GitHub Actions & GitHub Pages)

Deployment is fully automated using **GitHub Actions**.

### How Deployment Works:
1. Whenever code is pushed to the `main` branch, the [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) workflow triggers.
2. The runner automatically installs dependencies, executes `npm run build`, and compiles `dist/`.
3. The contents of `dist/` are published directly to **GitHub Pages**.

> **Note**: Build artifacts (`dist/`) are kept out of Git history and are generated strictly on the fly during deployment.

### GitHub Repository Setup (One-Time)
To activate automatic deployment:
1. Navigate to your repository on GitHub: **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **`GitHub Actions`**.

---

## ➕ Adding a New Sub-App

To add a new study application (e.g., `vocab-app`):

1. **Initialize the app**:
   Create a new Vite React app in a subfolder (e.g. `vocab-app/`).
2. **Configure Vite**:
   In `vocab-app/vite.config.js`, configure `build.outDir` to output to the central `dist/` directory:
   ```javascript
   export default defineConfig({
     plugins: [react(), viteSingleFile()],
     base: './',
     build: {
       outDir: '../dist/vocab',
       emptyOutDir: true,
     },
   })
   ```
3. **Update Root Script**:
   In root `package.json`, chain the new app build into the `build` script:
   ```json
   "build": "mkdir -p dist && cp index.html dist/ && npm run build --prefix grammar-app && npm run build --prefix vocab-app"
   ```
