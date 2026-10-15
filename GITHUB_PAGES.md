# GitHub Pages deployment

RoamSafe's dashboard is a static React/Vite build. GitHub Pages can serve it while the existing Solana devnet program continues to enforce vault policy.

The prepared workflow is .github/workflows/pages.yml. It installs pinned dependencies with npm ci, runs the demo policy tests and TypeScript checks, builds the dashboard at the Pages base path, and deploys only dist/. It needs no wallet key, Solana CLI, Rust build, or repository secret.

## Visibility
GitHub Pages websites are normally public. Free GitHub accounts require a public source repository; eligible paid plans also support Pages from private source repositories. Confirm source visibility before creating or uploading this private project's source to GitHub.

Official availability: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Prepared destination
- GitHub account: ryuuseiwa
- Suggested new repository: roamsafe
- Expected project path after a successful deployment: /roamsafe/
- Network: Solana devnet, using the committed web/deployment.json

This document describes the prepared setup; it does not assert that a repository or Pages site has been created.

## After the repository is approved and created
1. Push this repository to its GitHub remote.
2. Enable GitHub Pages with GitHub Actions as the build source.
3. Run or watch the Deploy RoamSafe to GitHub Pages workflow.
4. Verify that the published HTML, JS chunks, and stylesheet return successful responses at the repository path.

The Pages base path comes from actions/configure-pages and is passed to Vite's --base option only during the Pages build. The app remains compatible with root-domain hosting.

Vite deployment reference: https://vite.dev/guide/static-deploy.html

## Test the project-path build locally
From WSL with Node available:
```bash
npm run test:model
npm run build -- --base /roamsafe/
```

Real wallet mode continues to use devnet. For test tokens, use the devnet:tokens instructions in README.md.
