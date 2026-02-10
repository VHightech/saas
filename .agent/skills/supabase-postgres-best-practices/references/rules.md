---
title: Enable Row Level Security for Multi-Tenant Data
impact: MEDIUM-HIGH
impactDescription: Database-enforced tenant isolation, prevent data leaks
tags: rls, row-level-security, multi-tenant, security
---

## Enable Row Level Security for Multi-Tenant Data

Row Level Security (RLS) enforces data access at the database level, ensuring users only see their own data.

**Incorrect (application-level filtering only):**

```sql
-- Relying only on application to filter
select *
from orders
where user_id = $current_user_id;

-- Bug or bypass means all data is exposed!
-- Returns ALL orders:
select *
from orders;
```

**Correct (database-enforced RLS):**

```sql
-- Enable RLS on the table
alter table orders enable row level security;

-- Create policy for users to see only their orders
create policy orders_user_policy on orders
  for all
  using (
    user_id = current_setting('app.current_user_id')::bigint
  );

-- Force RLS even for table owners (optional but recommended for strictness)
alter table orders force row level security;

-- Set user context and query
set app.current_user_id = '123';
select * from orders;
-- Only returns orders for user 123
```

---
title: Always Index Foreign Keys
impact: CRITICAL
impactDescription: Prevents simple joins and cascading deletes from scanning entire tables.
tags: indexes, foreign-keys, performance
---

## Always Index Foreign Keys

Postgres does **not** automatically index foreign keys. If you frequently join specifically on these columns or perform cascading deletes, you must index them manually.

**Incorrect:**

```sql
create table orders (
  id bigint generated always as identity primary key,
  user_id bigint references users(id) -- No index created!
);

-- This delete might trigger a Sequential Scan on orders to find related records!
delete from users where id = 123;
```

**Correct:**

```sql
create table orders (
  id bigint generated always as identity primary key,
  user_id bigint references users(id)
);

-- Explicitly index the foreign key
create index on orders(user_id);
```

---
title: Use Connection Pooling in Serverless Environments
impact: CRITICAL
impactDescription: Prevents connection exhaustion and reduces latency overhead.
tags: connection-pooling, serverless, supavisor, pgbouncer
---

## Use Connection Pooling in Serverless Environments

Opening a new Postgres connection is expensive (SSL handshake, backend forking). Serverless functions (like AWS Lambda, Vercel Edge/Serverless) create many short-lived connections, quickly exhausting the database `max_connections` limit.

**Incorrect:**
Connecting directly to the Postgres instance from a serverless function (e.g. port 5432).

**Correct:**
Connect via a connection pooler like Supavisor or PgBouncer (often port 6543 or 5432 in pooled mode).
In Supabase, use the Transaction Pool URL/Mode for serverless functions.

---
title: Prefer `timestamptz` over `timestamp`
impact: HIGH
impactDescription: Avoidstimezone confusion and conversion errors.
tags: schema-design, data-types, dates, timezones
---

## Prefer `timestamptz` over `timestamp`

`timestamp without time zone` (often just `timestamp`) does not store timezone information. It assumes the time is already in the application's local time or UTC, leading to ambiguity.
`timestamptz` (`timestamp with time zone`) converts the input to UTC for storage and converts back to the client's timezone on retrieval.

**Incorrect:**

```sql
create table events (
  occurred_at timestamp
);
```

**Correct:**

```sql
create table events (
  occurred_at timestamptz
);
```
