---
type: Postgres Table
title: users
description: User accounts and their access level. One row per person who can log in.
resource: "postgres://db/example/users"
tags: [users-example, example-app]
timestamp: "2026-06-26T06:47:38.685Z"
columns: 4
---
# users

User accounts and their access level. One row per person who can log in.

| Field | Type | Nullable | Meaning | Relationships | Allowed values | Notes |
|---|---|---|---|---|---|---|
| id | varchar (uuid) | no | Primary key | referenced by most *_created_by columns | — | DB-generated UUID |
| username | varchar(50) | no | Login handle | — | unique |  |
| role | varchar(20) | no | Access level — what the user may do | — | admin \| supervisor \| user | drives RBAC |
| created_at | timestamp | yes | When the account was created | — | — | defaults to now() |

**Foreign keys:** none

**Sample queries:**
- All admins: `SELECT id, username FROM users WHERE role = 'admin';`
- Count by role: `SELECT role, count(*) FROM users GROUP BY role;`
