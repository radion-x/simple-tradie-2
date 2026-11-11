CREATE TABLE campaign_visits (
  id UUID PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('gumtree','google','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campaign_visits_created ON campaign_visits(created_at, source);
ALTER TABLE callback_requests
  ADD COLUMN visit_id UUID REFERENCES campaign_visits(id) ON DELETE SET NULL,
  ADD COLUMN latest_utm_source TEXT,
  ADD COLUMN sales_stage TEXT NOT NULL DEFAULT 'new' CHECK (sales_stage IN ('new','qualified','quoted','paid','lost','excluded')),
  ADD COLUMN sales_notes TEXT NOT NULL DEFAULT '',
  ADD COLUMN source_override TEXT CHECK (source_override IN ('gumtree','google','other')),
  ADD COLUMN source_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN capture_method TEXT NOT NULL DEFAULT 'website' CHECK (capture_method IN ('website','gumtree_message','phone','manual')),
  ADD COLUMN customer_key TEXT,
  ADD COLUMN paid_on DATE,
  ADD COLUMN paid_amount_cents INTEGER,
  ADD COLUMN payment_reference TEXT,
  ADD CONSTRAINT confirmed_payment CHECK (sales_stage <> 'paid' OR
    (customer_key IS NOT NULL AND length(trim(customer_key)) > 0 AND paid_on IS NOT NULL AND paid_amount_cents IS NOT NULL AND paid_amount_cents > 0 AND payment_reference IS NOT NULL AND length(trim(payment_reference)) > 0));
CREATE UNIQUE INDEX one_new_customer ON callback_requests(lower(trim(customer_key))) WHERE sales_stage='paid';
CREATE TABLE sales_changes (
  id BIGSERIAL PRIMARY KEY,
  callback_id INTEGER NOT NULL REFERENCES callback_requests(id) ON DELETE CASCADE,
  changed_by TEXT NOT NULL,
  previous JSONB NOT NULL,
  current JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
