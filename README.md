# Lineflow — Shift Management

English GitHub Pages version of the Lineflow shift rotation planner.

The application runs entirely in the browser and stores team lists, skills, line status and shift plans in that browser's local storage.

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


