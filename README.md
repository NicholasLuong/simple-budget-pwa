# simple-budget-pwa

This repository is configured to deploy to **GitHub Pages** via GitHub Actions.

## How deployment works

- On every push to `main`, the workflow at `.github/workflows/deploy-gh-pages.yml` runs.
- The workflow publishes the repository root as a static site.

## One-time GitHub setup

1. Open **Settings → Pages** in your GitHub repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Ensure your default deployment branch is `main`.

After that, push to `main` and your site will be available on your GitHub Pages URL.
