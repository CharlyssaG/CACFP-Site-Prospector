-- CACFP Site Prospector Database Schema
-- Run this in your Supabase SQL editor or as a migration

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE center_type AS ENUM ('nonprofit', 'for-profit', 'head-start');
CREATE TYPE area_eligibility AS ENUM ('eligible', 'maybe', 'not-eligible', 'unknown');

-- ============================================================
-- SPONSORS TABLE
-- ============================================================

CREATE TABLE sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state CHAR(2),
  zip CHAR(5),
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sponsors_state ON sponsors(state);
CREATE INDEX idx_sponsors_name ON sponsors USING gin(to_tsvector('english', name));

-- ============================================================
-- CENTERS TABLE
-- ============================================================

CREATE TABLE centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state CHAR(2) NOT NULL,
  zip VARCHAR(10) NOT NULL,
  county TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  director_name TEXT,
  center_type center_type NOT NULL DEFAULT 'nonprofit',
  is_licensed BOOLEAN DEFAULT true,
  license_number TEXT,
  license_expiry DATE,
  licensed_capacity INTEGER,
  current_enrollment INTEGER,
  area_eligibility area_eligibility DEFAULT 'unknown',
  frp_percentage NUMERIC(5,2),
  census_block_group TEXT,
  census_tract TEXT,
  subsidy_pct NUMERIC(5,2),
  is_cacfp_participant BOOLEAN DEFAULT false,
  sponsor_id UUID REFERENCES sponsors(id) ON DELETE SET NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  notes TEXT,
  source TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_centers_state ON centers(state);
CREATE INDEX idx_centers_zip ON centers(zip);
CREATE INDEX idx_centers_city ON centers USING gin(to_tsvector('english', city));
CREATE INDEX idx_centers_county ON centers USING gin(to_tsvector('english', county));
CREATE INDEX idx_centers_name ON centers USING gin(to_tsvector('english', name));
CREATE INDEX idx_centers_sponsor ON centers(sponsor_id);
CREATE INDEX idx_centers_type ON centers(center_type);
CREATE INDEX idx_centers_eligibility ON centers(area_eligibility);
CREATE INDEX idx_centers_participant ON centers(is_cacfp_participant);
CREATE INDEX idx_centers_geo ON centers(latitude, longitude);

-- ============================================================
-- OUTREACH LOG (track recruitment efforts)
-- ============================================================

CREATE TABLE outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  contact_method TEXT NOT NULL, -- 'email', 'phone', 'in-person', 'mail'
  contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contacted_by TEXT,
  notes TEXT,
  outcome TEXT, -- 'interested', 'not-interested', 'no-response', 'enrolled', 'follow-up'
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outreach_center ON outreach_log(center_id);
CREATE INDEX idx_outreach_date ON outreach_log(contact_date);

-- ============================================================
-- SEARCH LOG (analytics on what areas consultants search)
-- ============================================================

CREATE TABLE search_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  search_type TEXT NOT NULL, -- 'city', 'county', 'state', 'zip'
  results_count INTEGER DEFAULT 0,
  searched_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_log ENABLE ROW LEVEL SECURITY;

-- Public read access for centers and sponsors (anon key)
CREATE POLICY "Public read centers" ON centers FOR SELECT USING (true);
CREATE POLICY "Public read sponsors" ON sponsors FOR SELECT USING (true);

-- Authenticated users can insert/update
CREATE POLICY "Auth insert centers" ON centers FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth update centers" ON centers FOR UPDATE USING (true);
CREATE POLICY "Auth insert sponsors" ON sponsors FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth insert outreach" ON outreach_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth read outreach" ON outreach_log FOR SELECT USING (true);
CREATE POLICY "Anyone can log searches" ON search_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Full-text search across centers
CREATE OR REPLACE FUNCTION search_centers(
  search_query TEXT,
  search_type TEXT DEFAULT 'auto',
  filter_unsponsored BOOLEAN DEFAULT false,
  filter_type center_type DEFAULT NULL,
  filter_eligible BOOLEAN DEFAULT false,
  filter_licensed BOOLEAN DEFAULT false,
  sort_by TEXT DEFAULT 'name',
  result_limit INTEGER DEFAULT 100,
  result_offset INTEGER DEFAULT 0
)
RETURNS SETOF centers
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM centers c
  WHERE
    CASE
      WHEN search_type = 'zip' THEN c.zip = search_query
      WHEN search_type = 'state' THEN c.state = UPPER(search_query)
      WHEN search_type = 'county' THEN c.county ILIKE '%' || search_query || '%'
      WHEN search_type = 'city' THEN c.city ILIKE '%' || search_query || '%'
      ELSE (
        c.zip = search_query
        OR c.state = UPPER(search_query)
        OR c.city ILIKE '%' || search_query || '%'
        OR c.county ILIKE '%' || search_query || '%'
      )
    END
    AND (NOT filter_unsponsored OR c.sponsor_id IS NULL)
    AND (filter_type IS NULL OR c.center_type = filter_type)
    AND (NOT filter_eligible OR c.area_eligibility = 'eligible')
    AND (NOT filter_licensed OR c.is_licensed = true)
  ORDER BY
    CASE WHEN sort_by = 'name' THEN c.name END ASC,
    CASE WHEN sort_by = 'capacity-desc' THEN c.licensed_capacity END DESC,
    CASE WHEN sort_by = 'capacity-asc' THEN c.licensed_capacity END ASC,
    CASE WHEN sort_by = 'eligibility' THEN
      (CASE c.area_eligibility
        WHEN 'eligible' THEN 3
        WHEN 'maybe' THEN 2
        ELSE 1
      END)
      + (CASE WHEN c.sponsor_id IS NULL THEN 2 ELSE 0 END)
      + (CASE WHEN c.is_licensed THEN 1 ELSE 0 END)
    END DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;

-- Aggregate stats for a search result set
CREATE OR REPLACE FUNCTION get_search_stats(
  search_query TEXT,
  search_type TEXT DEFAULT 'auto'
)
RETURNS TABLE(
  total_count BIGINT,
  unsponsored_count BIGINT,
  eligible_count BIGINT,
  avg_capacity NUMERIC,
  nonprofit_count BIGINT,
  forprofit_count BIGINT,
  headstart_count BIGINT,
  licensed_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE c.sponsor_id IS NULL)::BIGINT,
    COUNT(*) FILTER (WHERE c.area_eligibility = 'eligible')::BIGINT,
    ROUND(AVG(c.licensed_capacity), 0),
    COUNT(*) FILTER (WHERE c.center_type = 'nonprofit')::BIGINT,
    COUNT(*) FILTER (WHERE c.center_type = 'for-profit')::BIGINT,
    COUNT(*) FILTER (WHERE c.center_type = 'head-start')::BIGINT,
    COUNT(*) FILTER (WHERE c.is_licensed = true)::BIGINT
  FROM centers c
  WHERE
    CASE
      WHEN search_type = 'zip' THEN c.zip = search_query
      WHEN search_type = 'state' THEN c.state = UPPER(search_query)
      WHEN search_type = 'county' THEN c.county ILIKE '%' || search_query || '%'
      WHEN search_type = 'city' THEN c.city ILIKE '%' || search_query || '%'
      ELSE (
        c.zip = search_query
        OR c.state = UPPER(search_query)
        OR c.city ILIKE '%' || search_query || '%'
        OR c.county ILIKE '%' || search_query || '%'
      )
    END;
END;
$$;

-- Updated-at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_centers_updated
  BEFORE UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER set_sponsors_updated
  BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
