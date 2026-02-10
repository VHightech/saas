-- Add missing dashboard_layout column to tenants table
alter table public.tenants 
add column if not exists dashboard_layout jsonb default '{"left": ["user_widget", "consumption_chart", "expenses_chart"], "right": ["recent_bills"]}'::jsonb;

comment on column public.tenants.dashboard_layout is 'Configuration for the dashboard widgets layout per tenant.';
