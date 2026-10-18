# Lineflow — Shift Management

English GitHub Pages version of the Lineflow shift rotation planner.

The application can run as a local-only GitHub Pages site or as a shared Render application backed by PostgreSQL. The browser keeps a local fallback copy so temporary connection loss does not stop the shift plan.

## Shared Render deployment

1. In Render, select **New → Blueprint** and connect this repository.
2. Render reads `render.yaml` and creates the web service plus PostgreSQL database.
3. Enter a private `APP_PASSWORD` when prompted.
4. After deployment, open the generated `onrender.com` address.
5. Sign in with username `lineflow` and the password entered in Render.

Everyone using the Render address shares the same teams, skills, line status and shift plan. The GitHub Pages address remains local-only. Never commit the application password or database URL to GitHub.

The supplied Blueprint uses Render's smallest permanent PostgreSQL plan (`0.1c-256mb`). Render displays and asks you to confirm the charge before the Blueprint is applied. The web service itself remains on the free plan.

## GitHub Pages

Publish this repository from the root of the default branch using GitHub Pages. The site entry point is `index.html`.

1. Create a GitHub repository and upload all files from this folder to its root.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the default branch, choose `/ (root)`, and save.

## Included rules

- Morning, Afternoon and Night shifts.
- Team-specific employee lists.
- Extra staff enter line positions before the remaining rotation is calculated.
- Explicit break coverage: who covers whom and who is on break.
- NEW employees require Extra support on Line 4, Line 7 and Line 8.
- NEW companions are reserved and cannot also appear as available Extra staff.
- WT is reserved for break cover and does not join normal rotation.
- AP stays assigned for the full shift and is covered by WT during breaks.
- Line 1 and Line 6 hot-line restriction.
- One-hour gap between Line 4, Line 7 and Line 8.
- Printable one-page shift plan.


