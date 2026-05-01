-- =============================================
-- PLANET RENT A CAR — Price Intelligence Schema
-- Pokreni u Supabase SQL Editoru
-- =============================================

-- Kategorije vozila
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id TEXT PRIMARY KEY,
  name_sr TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO vehicle_categories VALUES
  ('economy',   'Ekonomska',  'Economy',   1),
  ('compact',   'Kompaktna',  'Compact',   2),
  ('suv',       'SUV',        'SUV',       3),
  ('premium',   'Premium',    'Premium',   4),
  ('electric',  'Električna', 'Electric',  5),
  ('van',       'Kombiji/Van','Van',        6);

-- Konkurenti
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  is_manual BOOLEAN DEFAULT false, -- true = manuelni unos, false = auto scraping
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO competitors (id, name, website, is_active, is_manual, logo_url, created_at) VALUES
  ('planet',    'Planet Rent a Car',   'https://planetrentacar.me',   true,  false, NULL, NOW()),
  ('meridian',  'Meridian Rent a Car', 'https://meridianrentacar.com', true, true,  NULL, NOW()),
  ('sixt',      'Sixt Crna Gora',      'https://www.sixt.me',          true, true,  NULL, NOW()),
  ('europcar',  'Europcar CG',         'https://www.europcar.com',     true, true,  NULL, NOW()),
  ('budget',    'Budget/Avis',         'https://www.budget.com',       true, true,  NULL, NOW());

-- Cijene po konkurentu (snapshot po datumu provjere)
CREATE TABLE IF NOT EXISTS competitor_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id TEXT REFERENCES competitors(id),
  category_id TEXT REFERENCES vehicle_categories(id),
  vehicle_model TEXT,           -- npr. "Renault Clio"
  price_per_day DECIMAL(10,2),  -- cijena u EUR
  pickup_date DATE,             -- datum preuzimanja za koji je cijena
  return_date DATE,             -- datum vraćanja
  rental_days INTEGER,          -- broj dana (return - pickup)
  source_url TEXT,              -- URL sa kojeg je skinuta cijena
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  is_manual BOOLEAN DEFAULT false,
  notes TEXT
);

-- Moje cijene (Planet) — trebaju biti u istoj tabeli ali i posebno za historiju
CREATE TABLE IF NOT EXISTS my_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT REFERENCES vehicle_categories(id),
  vehicle_model TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,   -- osnovna cijena per day
  peak_price DECIMAL(10,2),            -- peak sezona cijena
  peak_start DATE,                     -- npr. 2025-06-15
  peak_end DATE,                       -- npr. 2025-09-15
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT DEFAULT 'admin'
);

-- Preporučene korekcije cijena (generišu se automatski na osnovu poređenja)
CREATE TABLE IF NOT EXISTS price_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id TEXT REFERENCES vehicle_categories(id),
  vehicle_model TEXT,
  current_price DECIMAL(10,2),
  recommended_price DECIMAL(10,2),
  avg_competitor_price DECIMAL(10,2),
  min_competitor_price DECIMAL(10,2),
  max_competitor_price DECIMAL(10,2),
  recommendation_type TEXT CHECK (recommendation_type IN ('increase','decrease','ok')),
  reason TEXT,
  is_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

-- Historija promjena cijena
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  my_price_id UUID REFERENCES my_prices(id),
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  change_reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by TEXT DEFAULT 'admin'
);

-- Scraping log
CREATE TABLE IF NOT EXISTS scrape_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id TEXT REFERENCES competitors(id),
  status TEXT CHECK (status IN ('success','failed','partial')),
  prices_found INTEGER DEFAULT 0,
  error_message TEXT,
  duration_ms INTEGER,
  scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies (enable Row Level Security)
ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_recommendations ENABLE ROW LEVEL SECURITY;

-- Dozvoli sve za service_role (admin)
CREATE POLICY "Service role full access" ON competitor_prices FOR ALL USING (true);
CREATE POLICY "Service role full access" ON my_prices FOR ALL USING (true);
CREATE POLICY "Service role full access" ON price_recommendations FOR ALL USING (true);

-- View: zadnje cijene po konkurentu i kategoriji
CREATE OR REPLACE VIEW latest_competitor_prices AS
SELECT DISTINCT ON (competitor_id, category_id)
  cp.*,
  c.name as competitor_name,
  c.is_manual,
  vc.name_sr as category_name
FROM competitor_prices cp
JOIN competitors c ON c.id = cp.competitor_id
JOIN vehicle_categories vc ON vc.id = cp.category_id
ORDER BY competitor_id, category_id, scraped_at DESC;

-- View: poređenje mojih cijena vs konkurencija
CREATE OR REPLACE VIEW price_comparison AS
SELECT
  mp.category_id,
  vc.name_sr as category_name,
  mp.vehicle_model,
  mp.base_price as my_price,
  mp.peak_price as my_peak_price,
  AVG(cp.price_per_day) as avg_competitor,
  MIN(cp.price_per_day) as min_competitor,
  MAX(cp.price_per_day) as max_competitor,
  COUNT(DISTINCT cp.competitor_id) as num_competitors,
  ROUND(((mp.base_price - AVG(cp.price_per_day)) / AVG(cp.price_per_day) * 100)::numeric, 1) as price_diff_pct
FROM my_prices mp
JOIN vehicle_categories vc ON vc.id = mp.category_id
LEFT JOIN competitor_prices cp ON cp.category_id = mp.category_id
  AND cp.scraped_at > NOW() - INTERVAL '7 days'
  AND cp.competitor_id != 'planet'
WHERE mp.is_active = true
GROUP BY mp.category_id, vc.name_sr, mp.vehicle_model, mp.base_price, mp.peak_price;
