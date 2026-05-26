-- Ensure PostgREST can expose lethia_build schema
ALTER ROLE authenticator SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build';
ALTER ROLE anon SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build';
ALTER ROLE service_role SET pgrst.db_schemas = 'public,agent_business_analyst,lethia_build';
GRANT USAGE ON SCHEMA lethia_build TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA lethia_build TO anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA lethia_build TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lethia_build
GRANT ALL ON TABLES TO anon, authenticated, service_role;
