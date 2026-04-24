-- CACFP Site Prospector — Seed Data
-- Run after the migration to populate demo centers and sponsors

-- ============================================================
-- SPONSORS
-- ============================================================

INSERT INTO sponsors (name, phone, email, city, state, zip) VALUES
  ('Child Care Food Program Inc.', '(702) 555-0100', 'info@ccfpi.org', 'Las Vegas', 'NV', '89101'),
  ('Community Nutrition Alliance', '(602) 555-0200', 'contact@cna-az.org', 'Phoenix', 'AZ', '85001'),
  ('Kids Meals Network', '(303) 555-0300', 'hello@kidsmeals.org', 'Denver', 'CO', '80201'),
  ('Healthy Start Food Services', '(713) 555-0400', 'admin@healthystartfs.org', 'Houston', 'TX', '77001'),
  ('Children''s Nutrition Council', '(404) 555-0500', 'info@cnc-ga.org', 'Atlanta', 'GA', '30301'),
  ('Metro Area CACFP Sponsor', '(312) 555-0600', 'cacfp@metroarea.org', 'Chicago', 'IL', '60601'),
  ('State Child Nutrition Services', '(305) 555-0700', 'nutrition@scns-fl.org', 'Miami', 'FL', '33101'),
  ('United Child Care Foundation', '(213) 555-0800', 'programs@uccf.org', 'Los Angeles', 'CA', '90001');

-- ============================================================
-- CENTERS — Sample across multiple cities
-- ============================================================

-- We'll insert a representative sample; in production you'd import
-- from state licensing databases.

DO $$
DECLARE
  sp_ids UUID[];
  cities TEXT[][] := ARRAY[
    ARRAY['Las Vegas', 'NV', 'Clark County', '89'],
    ARRAY['Phoenix', 'AZ', 'Maricopa County', '85'],
    ARRAY['Denver', 'CO', 'Denver County', '80'],
    ARRAY['Houston', 'TX', 'Harris County', '77'],
    ARRAY['Atlanta', 'GA', 'Fulton County', '30'],
    ARRAY['Chicago', 'IL', 'Cook County', '60'],
    ARRAY['Miami', 'FL', 'Miami-Dade County', '33'],
    ARRAY['Los Angeles', 'CA', 'Los Angeles County', '90']
  ];
  prefixes TEXT[] := ARRAY['Little', 'Bright', 'Sunshine', 'Rainbow', 'Happy', 'Growing', 'Creative',
    'Discovery', 'Future', 'Tender', 'Stepping', 'Tiny', 'New', 'First', 'Golden',
    'Caring', 'Joyful', 'Star', 'Learning', 'ABC', 'Kids', 'Community', 'Heritage',
    'Sunrise', 'Valley', 'Oak', 'Maple', 'Open', 'Cedar', 'Willow'];
  suffixes TEXT[] := ARRAY['Stars', 'Beginnings', 'Minds', 'Academy', 'Learning Center',
    'Child Care', 'Daycare', 'Development Center', 'Kids Academy', 'Early Learning',
    'Preschool', 'Child Development', 'Care Center', 'Children''s Center', 'Tots',
    'Tree Academy', 'Garden', 'Explorers', 'Adventurers', 'Scholars'];
  streets TEXT[] := ARRAY['Main St', 'Oak Ave', 'Elm Blvd', 'Cedar Rd', 'Pine St',
    'Maple Dr', 'Washington Blvd', 'Lincoln Ave', 'Park Rd', 'Lake Dr',
    '1st Ave', '2nd St', 'Highland Dr', 'Sunset Blvd', 'Valley Rd'];
  directors TEXT[] := ARRAY['Maria Garcia', 'Sarah Johnson', 'Jennifer Williams', 'Patricia Brown',
    'Linda Davis', 'Jessica Martinez', 'Ashley Wilson', 'Amanda Moore',
    'Stephanie Taylor', 'Nicole Anderson', 'Kimberly Thomas', 'Michelle Jackson'];
  city_row TEXT[];
  i INT;
  c_name TEXT;
  c_type center_type;
  c_elig area_eligibility;
  cap INT;
  frp NUMERIC;
  sub_pct NUMERIC;
  is_spon BOOLEAN;
  spon UUID;
  zip_code TEXT;
BEGIN
  SELECT array_agg(id) INTO sp_ids FROM sponsors;

  FOREACH city_row SLICE 1 IN ARRAY cities LOOP
    FOR i IN 1..15 LOOP
      c_name := prefixes[1 + floor(random() * array_length(prefixes,1))::int % array_length(prefixes,1)]
                || ' '
                || suffixes[1 + floor(random() * array_length(suffixes,1))::int % array_length(suffixes,1)];

      IF random() > 0.85 THEN c_type := 'head-start';
      ELSIF random() > 0.4 THEN c_type := 'nonprofit';
      ELSE c_type := 'for-profit';
      END IF;

      cap := 20 + floor(random() * 150)::int;
      frp := 10 + floor(random() * 75)::int;
      sub_pct := CASE WHEN c_type = 'for-profit' THEN 5 + floor(random() * 35)::int
                      ELSE 15 + floor(random() * 50)::int END;

      IF frp >= 50 THEN c_elig := 'eligible';
      ELSIF frp >= 40 THEN c_elig := 'maybe';
      ELSE c_elig := 'unknown';
      END IF;

      is_spon := random() > 0.55;
      spon := CASE WHEN is_spon THEN sp_ids[1 + floor(random() * array_length(sp_ids,1))::int % array_length(sp_ids,1)]
                   ELSE NULL END;

      zip_code := city_row[4] || lpad((floor(random() * 300) + 100)::text, 3, '0');

      INSERT INTO centers (
        name, address, city, state, zip, county, phone, email,
        director_name, center_type, is_licensed, license_number,
        licensed_capacity, current_enrollment, area_eligibility,
        frp_percentage, subsidy_pct, is_cacfp_participant, sponsor_id, source
      ) VALUES (
        c_name,
        (100 + floor(random() * 9000)::int)::text || ' ' || streets[1 + floor(random() * array_length(streets,1))::int % array_length(streets,1)],
        city_row[1],
        city_row[2],
        zip_code,
        city_row[3],
        '(' || left(zip_code, 3) || ') ' || (100 + floor(random()*900)::int)::text || '-' || (1000 + floor(random()*9000)::int)::text,
        lower(replace(replace(c_name, ' ', ''), '''', '')) || '@' || CASE WHEN c_type = 'for-profit' THEN 'gmail.com' ELSE 'org' END,
        directors[1 + floor(random() * array_length(directors,1))::int % array_length(directors,1)],
        c_type,
        random() > 0.08,
        city_row[2] || '-' || (100000 + floor(random()*900000)::int)::text,
        cap,
        floor(cap * (0.5 + random() * 0.45))::int,
        c_elig,
        frp,
        sub_pct,
        is_spon,
        spon,
        'demo-seed'
      );
    END LOOP;
  END LOOP;
END;
$$;
