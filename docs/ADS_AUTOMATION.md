# Ads Automation & Optimization

## Purpose
Automate paid-media management for Base44 by combining campaign templates, Firebase-authenticated APIs, and BullMQ workers. The platform creates campaigns, generates AI variants, ingests metrics, and rebalances budgets automatically.

## Lifecycle Overview
1. **Campaign Creation** (`POST /api/ads/campaigns`)
   - Persists metadata in Prisma `Campaign` table with default targets (e.g., `targetCpa`, optimization window hours).
   - When launched, the system schedules a repeat optimization job every 30 minutes.
2. **Creative Intake**
   - Upload assets via `/api/uploads/*`; each file becomes an `AdCreative` record.
   - AI variant generation (`POST /api/ads/campaigns/:id/generate`) calls GPT for hooks, captions, hashtags, CTAs.
3. **Launch & Control** (`POST /api/ads/campaigns/:id/start|stop`)
   - **Start:** status → `ACTIVE`, enqueues `campaign-start`, registers repeat `optimization-tick` job.
   - **Stop:** status → `PAUSED`, removes repeat job, enqueues `campaign-stop` for cleanup.
4. **Metrics Ingestion** (`POST /api/ads/webhook/meta`)
   - Validates signature when `META_WEBHOOK_SECRET` is configured.
   - Stores payload in `AdMetricIngest` staging table and queues processing into `AdMetric` / `CampaignMetrics`.
5. **Optimization Loop** (`adOptimizerWorker`)
   - BullMQ `ad-optimization` queue runs on each scheduled tick.
   - Flow: aggregate recent metrics → pause losers → boost winners (+20% budget, max 2×) → spawn mutation variants if CPA drifts → write changes to `ActionLog` → move campaigns to retargeting if unprofitable ≥5 days.

## Optimization Rules
| Trigger | Action | Notes |
|---------|--------|-------|
| Variant CPA > target *and* conversions = 0 | Pause variant | Requires ≥100 impressions. |
| CTR > 4% but conversions < 1 | Log landing-page insight | Leaves variant active for manual review. |
| Winner profitable 3 days | Increase budget +20% (cap 2×) | Applied repeatedly on subsequent ticks. |
| Campaign CPA > target for ≥5 days | Pause campaign, mark retargeting | Sets `Campaign.meta.retargetingPoolActivated = true`. |
| Missing Firebase credentials | Protected routes return 503 | Ensure service account file or env vars are present. |

## Metric Expectations
- **Inputs:** Aggregated `AdMetric` rows per variant (impressions, clicks, conversions, spend).
- **Outputs:** `ActionLog` audit entries, budget/status updates, optional mutation variants.
- **North-star KPI:** Keep CAC / CPL ≤ `campaign.meta.targetCpa` while raising conversions week over week.

## User Experience (Frontend)
- `/ads`: campaign list with status indicators and quick navigation.
- `/ads/[id]/builder`: creative uploader, AI generation, start/stop controls, variant grid.
- `/ads/[id]/performance`: summaries + detailed table of metrics.
- `/api/ads/templates`: blueprint catalogue for fast campaign setup.

## Runbook Checklist
1. Configure Firebase Admin credentials (service account JSON or env variables).
2. Confirm Redis is running (`REDIS_URL`).
3. Apply database migrations (`ActionLog`, `AdMetricIngest`, etc.).
4. Start services: `pnpm run dev` (API) and `pnpm --filter api start-optimizer` (worker).
5. Seed test campaign:
   ```bash
   curl -X POST http://localhost:4000/api/ads/campaigns \
     -H "Authorization: Bearer <firebase-token>" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test Campaign","objective":"conversions","budgetDaily":150}'
   ```
6. Upload a creative, call `POST /api/ads/campaigns/:id/generate`.
7. POST sample metrics to `/api/ads/webhook/meta` (see integration script below).
8. Inspect `ActionLog` table for optimizer decisions.

## What Users Should Expect
- Budget shifts and pause decisions within ~30 minutes of new metrics arriving.
- Planned notifications when variants pause or new mutations are added.
- Templates accelerate configuration but remain fully editable.
- No metrics = no changes: verify Meta pixel and CAPI events are firing.
- Errors surface in UI banners and in `ActionLog` / `AdMetricIngest.errorMessage` for support triage.

## Troubleshooting
- **Optimizer silent:** Check queue health (`bull-board`, Redis CLI) and confirm repeat job `campaign:<id>:optimizer` exists.
- **Webhook 401:** Ensure `META_WEBHOOK_SECRET` matches the `x-hub-signature-256` header (sha256=...).
- **Budget static:** Verify conversions are recorded; optimizer only scales variants showing wins.
- **Mutation missing:** See `ActionLog` for `variant_mutation_failed` (often GPT or OpenAI issues).
