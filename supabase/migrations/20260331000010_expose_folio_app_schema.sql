-- Expose folio_app schema to PostgREST
-- Add folio_app to the list of schemas accessible via PostgREST

ALTER ROLE authenticator SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build,folio_app';
ALTER ROLE anon SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build,folio_app';
ALTER ROLE service_role SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build,folio_app';
-- Grant access to folio_app schema
GRANT USAGE ON SCHEMA folio_app TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA folio_app TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA folio_app TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA folio_app
GRANT ALL ON TABLES TO anon, authenticated, service_role;
