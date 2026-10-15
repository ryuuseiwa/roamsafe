# GitHub Pages
- Website: https://ryuuseiwa.github.io/roamsafe/
- Public repository: https://github.com/ryuuseiwa/roamsafe
- Deployment workflow: https://github.com/ryuuseiwa/roamsafe/actions/workflows/pages.yml

The owner approved publishing both the source and dashboard publicly. Private keys, environment files, build output, and local validator data are excluded from Git history.

## How deployment works
Pushing to main starts .github/workflows/pages.yml. It installs dependencies with npm ci, runs the demo policy tests and TypeScript checks, builds the dashboard at the Pages base path, and deploys only dist/. It needs no wallet key, Solana CLI, Rust build, or repository secret.

The Pages base path comes from actions/configure-pages and is passed to Vite's --base option only during the Pages build. The app remains compatible with root-domain hosting. Production wallet mode uses the existing Solana devnet program and test mint from web/deployment.json.

The workflow grants read-only source access to the build and limits Pages publication and OIDC permissions to the deployment job. Its official GitHub Actions are pinned to verified commit hashes.

## Update the live app
From WSL with Node and GitHub access:
```bash
npm run test:model
npm run build -- --base /roamsafe/
git add <changed-files>
git commit -m "Describe the update"
git push origin main
```
Watch the Actions tab for the deployment result.

## Test tokens
Use the devnet:tokens instructions in README.md to mint test tokens to a browser wallet. Select Devnet in Phantom or Solflare and connect on the website. Test tokens are not USDC.

## References
- GitHub Pages workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Vite project-path deployment: https://vite.dev/guide/static-deploy.html
