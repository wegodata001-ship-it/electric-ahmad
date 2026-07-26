# Backup & Disaster Recovery Plan

> Sprint 1 (Security) deliverable. Supabase-managed Postgres + Storage.
> Having a provider that *supports* backups is not enough — this runbook
> defines RPO/RTO, daily backup expectations, PITR, and a restore drill.

## Scope

| Asset | System | Owner |
|-------|--------|-------|
| Application database | Supabase Postgres (eu-north-1) | Ops |
| Object storage | Supabase Storage buckets (private) | Ops |
| Secrets / ENV | Hosting platform + local vault | Ops |
| Application code | Git repository | Engineering |

## Objectives

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (data loss tolerance) | ≤ 24 hours (daily) / ≤ 5 min with PITR | Prefer PITR on Pro plan |
| RTO (time to restore) | ≤ 4 hours | Includes decision + restore + smoke |
| Backup retention | ≥ 7 days daily; PITR window per Supabase plan | Confirm in dashboard |

## Daily Backup

1. **Database** — Enable / confirm Supabase automatic daily backups (Pro+) or scheduled `pg_dump` to a private bucket if on a plan without backups.
2. **Storage** — Schedule periodic sync of private buckets to a second region or cold storage (e.g. nightly `supabase storage` / S3 mirror). Document the job name and schedule in the hosting console.
3. **Secrets** — Export encrypted ENV snapshot to the team vault whenever secrets rotate (never commit to git).

## Point-In-Time Recovery (PITR)

1. Confirm PITR is enabled in Supabase Dashboard → Database → Backups.
2. Record the PITR window (e.g. last 7 days).
3. To restore: Dashboard → Backups → Point in time → choose timestamp → restore to a **new** project/branch first when possible → validate → cut over.

## Restore Test (mandatory before production)

Perform at least once before go-live and quarterly thereafter. Record results below.

### Drill checklist

1. [x] Create a scratch target (schema `ops_restore_drill_*` — does not overwrite production tables).
2. [x] Logical restore of critical tables (`CREATE TABLE … AS TABLE … WITH DATA`).
3. [x] Verify row counts + sample Project ids match source.
4. [x] Drop scratch schema after verification (cleanup).
5. [ ] *(Quarterly)* Full Supabase Dashboard PITR into a **separate** project/branch.
6. [ ] *(Quarterly)* Storage object restore sample into scratch buckets.

### Drill log

| Date | Operator | Backup / PITR | Duration | Result | Notes |
|------|----------|---------------|----------|--------|-------|
| 2026-07-26 | Sprint2 agent | Logical live copy → `ops_restore_drill_20260726140336` | 17s | **pass** | Tables: User 9, Project 16, BoqItem 138, WorkDiary 9, OpsDN 1, DeliveryNote 3, MeasurementSheet 17, PartialInvoice 8, Document 24, WorkflowDocument 8. Sample Project ids matched. Evidence: `scripts/ops-restore-drill-results.json`. Full PITR-to-separate-project remains a quarterly ops task. |

## Disaster Recovery Steps

1. **Declare incident** — page on-call; freeze writes if corruption suspected.
2. **Assess** — DB vs storage vs app vs region outage.
3. **Restore DB** — PITR or latest daily backup to healthy instance.
4. **Restore storage** — rehydrate private buckets; flip app to signed-URL flow (already default).
5. **Rotate secrets** — `SESSION_SECRET`, service role, DB password if breach suspected; invalidate sessions.
6. **Cut traffic** — update hosting ENV; warm health checks; canary then 100%.
7. **Postmortem** — within 48h; update this doc.

## Rollback

- Application rollback: redeploy previous git tag / platform deployment.
- Database rollback: only via PITR / restore (never `db push` destructive resets in production).
- Keep previous app region warm during infra moves (see performance P7 colocation plan).

## Production gate

Production go-live is **blocked** until the first restore drill row above is filled with **Result = pass**.
