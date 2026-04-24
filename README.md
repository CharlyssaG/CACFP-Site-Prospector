# CACFP Site Prospector

A recruitment tool for CACFP nonprofit sponsors to identify childcare centers that may be eligible for the USDA Child and Adult Care Food Program.

## Features

- **Search** by city, county, state, or ZIP code with auto-detection
- **Filter** by sponsorship status, organization type, area eligibility, licensing
- **Sort** by name, capacity, or composite eligibility score
- **View** detailed center cards with contact info, capacity, FRP rates, sponsor details
- **Export** filtered results to CSV for CRM import
- **Track** outreach via the outreach log table
- **API routes** for server-side search and CSV export

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Hosting**: Vercel
- **Fonts**: DM Serif Display + Source Sans 3

---

## Deployment Guide

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration files in order:
   - `supabase/migrations/001_initial_schema.sql` — creates tables, indexes, functions, RLS policies
   - `supabase/migrations/002_seed_data.sql` — populates demo centers and sponsors
3. From **Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. GitHub Repository

```bash
git init
git add .
git commit -m "Initial commit — CACFP Site Prospector"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/cacfp-site-prospector.git
git push -u origin main
```

### 3. Vercel Deployment

1. Go to [vercel.com](https://vercel.com) and click **Import Project**
2. Select your GitHub repository
3. Vercel auto-detects Next.js — accept defaults
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Deploy**

Every push to `main` triggers automatic redeployment.

### 4. Local Development

```bash
cp .env.local.example .env.local
# Fill in your Supabase credentials

npm install
npm run dev
# Open http://localhost:3000
```

---

## Database Schema

### `centers`
Childcare center records with licensing, capacity, eligibility, and contact data.

### `sponsors`
CACFP sponsoring organizations. Centers link to sponsors via `sponsor_id`.

### `outreach_log`
Track recruitment contacts — method, date, outcome, follow-up scheduling.

### `search_log`
Analytics on consultant search patterns.

### Key Functions
- `search_centers()` — full-text search with filters and sorting
- `get_search_stats()` — aggregate statistics for a search area

---

## Populating with Real Data

The seed file includes demo data. For production, you'll want to import from:

1. **State licensing databases** — most states publish licensed childcare provider lists (often as downloadable CSVs or searchable directories)
2. **USDA CACFP area eligibility data** — the FNS Area Eligibility Mapper provides census-based FRP percentages
3. **State agency sponsor lists** — contact your state CACFP office for current sponsor rosters
4. **National CACFP Association** Find-a-Sponsor directory at cacfp.org

### Import approach

Write a data pipeline that:
1. Downloads state licensing CSV/API data
2. Geocodes addresses and looks up census block groups
3. Cross-references with CACFP participation records
4. Upserts into the `centers` table via Supabase

---

## API Endpoints

### `GET /api/search`
Query parameters: `q`, `type`, `unsponsored`, `centerType`, `eligible`, `licensed`, `sort`, `limit`, `offset`

### `GET /api/export`
Returns CSV file. Query parameters: `q`, `type`

---

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── search/route.ts    # Server-side search
│   │   │   └── export/route.ts    # CSV export
│   │   ├── globals.css            # Tailwind + custom styles
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Main page component
│   ├── components/
│   │   ├── SearchBar.tsx
│   │   ├── FilterBar.tsx
│   │   ├── StatsBar.tsx
│   │   ├── CenterCard.tsx
│   │   └── Legend.tsx
│   ├── lib/
│   │   ├── supabase.ts            # Supabase client
│   │   └── data.ts                # Data fetching utilities
│   └── types/
│       └── index.ts               # TypeScript interfaces
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Tables, indexes, RLS, functions
│       └── 002_seed_data.sql       # Demo data
├── vercel.json
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```
