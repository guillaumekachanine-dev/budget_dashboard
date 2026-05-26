-- Create views in public schema to expose ai_news tables from folio_app
-- This allows PostgREST to access the tables

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.ai_news_articles CASCADE;
DROP VIEW IF EXISTS public.ai_news_digests CASCADE;
-- Create views that expose the folio_app tables
CREATE VIEW public.ai_news_digests AS
SELECT * FROM folio_app.ai_news_digests;
CREATE VIEW public.ai_news_articles AS
SELECT * FROM folio_app.ai_news_articles;
-- Create INSERT trigger for ai_news_digests
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
CREATE TRIGGER ai_news_digests_insert
INSTEAD OF INSERT ON public.ai_news_digests
FOR EACH ROW EXECUTE FUNCTION public.insert_ai_news_digests();
-- Create UPDATE trigger for ai_news_digests
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
CREATE TRIGGER ai_news_digests_update
INSTEAD OF UPDATE ON public.ai_news_digests
FOR EACH ROW EXECUTE FUNCTION public.update_ai_news_digests();
-- Create INSERT trigger for ai_news_articles
CREATE OR REPLACE FUNCTION public.insert_ai_news_articles()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO folio_app.ai_news_articles
  (title, category, source_name, source_url, article_url, published_at, selection_date, rank, summary, featured_image_url, created_at, updated_at)
  VALUES (NEW.title, NEW.category, NEW.source_name, NEW.source_url, NEW.article_url, NEW.published_at, NEW.selection_date, NEW.rank, NEW.summary, NEW.featured_image_url, NOW(), NOW())
  ON CONFLICT (article_url) DO UPDATE SET
    title = EXCLUDED.title,
    category = EXCLUDED.category,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    published_at = EXCLUDED.published_at,
    selection_date = EXCLUDED.selection_date,
    rank = EXCLUDED.rank,
    summary = EXCLUDED.summary,
    featured_image_url = EXCLUDED.featured_image_url,
    updated_at = NOW()
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER ai_news_articles_insert
INSTEAD OF INSERT ON public.ai_news_articles
FOR EACH ROW EXECUTE FUNCTION public.insert_ai_news_articles();
-- Create UPDATE trigger for ai_news_articles
CREATE OR REPLACE FUNCTION public.update_ai_news_articles()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE folio_app.ai_news_articles
  SET title = NEW.title,
      category = NEW.category,
      source_name = NEW.source_name,
      source_url = NEW.source_url,
      article_url = NEW.article_url,
      published_at = NEW.published_at,
      selection_date = NEW.selection_date,
      rank = NEW.rank,
      summary = NEW.summary,
      featured_image_url = NEW.featured_image_url,
      updated_at = NOW()
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER ai_news_articles_update
INSTEAD OF UPDATE ON public.ai_news_articles
FOR EACH ROW EXECUTE FUNCTION public.update_ai_news_articles();
-- Grant permissions
GRANT SELECT ON public.ai_news_digests TO authenticated;
GRANT INSERT, UPDATE ON public.ai_news_digests TO authenticated;
GRANT SELECT ON public.ai_news_articles TO authenticated;
GRANT INSERT, UPDATE ON public.ai_news_articles TO authenticated;
