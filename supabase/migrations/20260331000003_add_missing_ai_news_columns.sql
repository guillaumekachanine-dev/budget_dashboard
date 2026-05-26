-- Add missing columns to ai_news_digests
ALTER TABLE folio_app.ai_news_digests
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS key_insights TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Add missing columns to ai_news_articles
ALTER TABLE folio_app.ai_news_articles
ADD COLUMN IF NOT EXISTS source_name TEXT,
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS article_url TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS selection_date DATE,
ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 999,
ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
-- Populate article_url with existing url if not set
UPDATE folio_app.ai_news_articles
SET article_url = COALESCE(article_url, url)
WHERE article_url IS NULL AND url IS NOT NULL;
-- Set source_name from source if not set
UPDATE folio_app.ai_news_articles
SET source_name = COALESCE(source_name, source)
WHERE source_name IS NULL AND source IS NOT NULL;
-- Set selection_date from published_at if not set
UPDATE folio_app.ai_news_articles
SET selection_date = COALESCE(selection_date, published_at::DATE)
WHERE selection_date IS NULL AND published_at IS NOT NULL;
-- Recreate the views to include new columns
DROP VIEW IF EXISTS public.ai_news_articles CASCADE;
DROP VIEW IF EXISTS public.ai_news_digests CASCADE;
CREATE VIEW public.ai_news_digests AS
SELECT id, date, category, content, article_count, summary, key_insights, created_at, updated_at FROM folio_app.ai_news_digests;
CREATE VIEW public.ai_news_articles AS
SELECT id, title, url, summary, category, source, published_at, ingested_at, digest_id,
       source_name, source_url, article_url, selection_date, rank, featured_image_url, updated_at
FROM folio_app.ai_news_articles;
-- Recreate the insert/update triggers to handle new columns
CREATE OR REPLACE FUNCTION public.insert_ai_news_digests()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO folio_app.ai_news_digests (date, category, content, article_count, summary, key_insights, created_at, updated_at)
  VALUES (NEW.date, NEW.category, COALESCE(NEW.content, ''), COALESCE(NEW.article_count, 0), NEW.summary, NEW.key_insights, NOW(), NOW())
  ON CONFLICT (date, category) DO UPDATE SET
    content = EXCLUDED.content,
    article_count = EXCLUDED.article_count,
    summary = EXCLUDED.summary,
    key_insights = EXCLUDED.key_insights,
    updated_at = NOW()
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.update_ai_news_digests()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE folio_app.ai_news_digests
  SET date = NEW.date,
      category = NEW.category,
      content = NEW.content,
      article_count = NEW.article_count,
      summary = NEW.summary,
      key_insights = NEW.key_insights,
      updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.insert_ai_news_articles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO folio_app.ai_news_articles
  (title, url, summary, category, source, published_at, ingested_at, digest_id, source_name, source_url, article_url, selection_date, rank, featured_image_url, updated_at)
  VALUES (NEW.title, NEW.url, NEW.summary, NEW.category, NEW.source, NEW.published_at, NOW(), NEW.digest_id, NEW.source_name, NEW.source_url, NEW.article_url, NEW.selection_date, COALESCE(NEW.rank, 999), NEW.featured_image_url, NOW())
  ON CONFLICT (article_url) DO UPDATE SET
    title = EXCLUDED.title,
    url = EXCLUDED.url,
    summary = EXCLUDED.summary,
    category = EXCLUDED.category,
    source = EXCLUDED.source,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    published_at = EXCLUDED.published_at,
    selection_date = EXCLUDED.selection_date,
    rank = EXCLUDED.rank,
    featured_image_url = EXCLUDED.featured_image_url,
    updated_at = NOW()
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.update_ai_news_articles()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE folio_app.ai_news_articles
  SET title = NEW.title,
      url = NEW.url,
      summary = NEW.summary,
      category = NEW.category,
      source = NEW.source,
      source_name = NEW.source_name,
      source_url = NEW.source_url,
      article_url = NEW.article_url,
      published_at = NEW.published_at,
      selection_date = NEW.selection_date,
      rank = NEW.rank,
      featured_image_url = NEW.featured_image_url,
      updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
