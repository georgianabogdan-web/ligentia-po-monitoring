# Ligentia PO Monitoring — setup & sync

A demo of the **PO Monitoring** section of [PO-agent](https://github.com/georgianabogdan-web/PO-agent),
with demo data extracted from Ligentia's Snowflake warehouse (Nisbets `PLC_PROD_*`).

- **Live:** https://georgianabogdan-web.github.io/ligentia-po-monitoring/
- **Upstream:** `georgianabogdan-web/PO-agent` (the canonical app — features live there)

## How it stays in sync with PO-agent

Only **one file differs** from upstream: [`src/poData.ts`](src/poData.ts) — the swappable
data layer (suppliers, POs, journey/fill profiles). Everything else (all UI, logic, the
predictive model) is inherited from PO-agent, so upstream feature changes flow in with
almost no conflict. [`.gitattributes`](.gitattributes) marks `src/poData.ts` as `merge=ours`
so a sync never overwrites the Ligentia data.

## One-time enable of automation (needs `workflow` scope)

The deploy/sync workflow is staged at [`deploy/sync-and-deploy.yml`](deploy/sync-and-deploy.yml)
because the setup token couldn't push into `.github/workflows/`. Enable it **either** way:

**A. Via the GitHub web UI (no scope change)**
1. Repo → **Add file → Create new file** → name it `.github/workflows/sync-and-deploy.yml`.
2. Paste the contents of `deploy/sync-and-deploy.yml`, commit to `main`.

**B. Via CLI (grant scope once)**
```bash
gh auth refresh -h github.com -s workflow      # complete the one-time device prompt
git mv deploy/sync-and-deploy.yml .github/workflows/sync-and-deploy.yml
git commit -m "Enable sync & deploy workflow" && git push
```

Once enabled:
- **Every push to `main`** rebuilds and redeploys to GitHub Pages.
- **Weekly (Mon 06:00 UTC)** — and on manual *Run workflow* — it merges upstream PO-agent,
  preserves the Ligentia data, and redeploys. Adjust the `cron` in the workflow to taste.
- If an upstream merge ever conflicts **outside** `src/poData.ts`, the run fails loudly so
  you can resolve it once by hand (rare — happens only if a feature change collides with the
  same lines the data layer was extracted from).

> Until the workflow is enabled, deploys are manual: `npm run build`, then publish `dist/`
> to the `gh-pages` branch.

## Local dev

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```
