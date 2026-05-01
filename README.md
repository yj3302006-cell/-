# Hoppers Calculator

Updated deployment settings.
Force update: 1.0.2
Manual trigger: Forcing deployment update to ensure dist is served.
Current state: index.html at root, main.tsx at root, base /hoppers-calculator/ in vite config.
Manual trigger: Final attempt to ensure GitHub Actions serves the 'dist' folder correctly.
Everything is configured: base path, build script, and deployment artifact path.
Time: 2026-05-01T08:31:00Z
Status: Final verification of deployment settings. Triggering build at 2026-05-01T15:09:00Z.
Manual fix: Standardized structure (moved main.tsx to src/), set base to './', and disabled hashing for predictable asset names.
Final check: GitHub Actions is confirmed to deploy the 'dist' folder.
Deployment sync: 1.1.5 (Standardized Build)

### ⚠️ IMPORTANT: GitHub Pages Configuration ⚠️
To fix the 404 error, you **MUST** change your GitHub Repository settings:
1. Go to your GitHub Repository **Settings**.
2. Click on **Pages** in the left sidebar.
3. Under **Build and deployment** -> **Source**, change from "Deploy from a branch" to **"GitHub Actions"**.
4. The deployment will now correctly use the `dist` folder created by Vite.

