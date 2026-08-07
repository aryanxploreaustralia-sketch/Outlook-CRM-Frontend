# src/admin — Enterprise Admin Platform

The administration module. One React application, one backend, one database —
a module inside the CRM, not a second product.

- **Phase 14.1** built the interface foundation against fixtures.
- **Phase 14.2** connected it to the real backend, **read-only**, and removed
  Billing entirely.

## Containment

Everything lives under `src/admin/`, with **one exception**:

| File | Change | Phase |
|---|---|---|
| `src/routes/router.jsx` | one import, one array entry (`adminRoute`) | 14.1 |

Nothing else outside this directory has been created, edited or deleted.
Removing that array entry removes the entire admin surface.

## Data

Every figure on every screen comes from `GET /api/v1/admin/*`, aggregated live
from the collections the CRM modules already own. Nothing is stored twice, there
is no snapshot table and there is no cache.

**`src/admin/data/` no longer exists.** It held the Phase 14.1 fixtures and was
deleted whole in 14.2, together with the artificial `delay()` in the service
layer and the Ready / Loading / Empty developer switch in `AdminHeader`.

## The one seam

```
page → useAdminResource → admin.service → httpClient → /api/v1/admin/*
```

`services/admin.service.js` is the only file that knows a URL. Its exported
names, arguments and resolved shapes did not change when the data became real,
which is why no page needed rewriting for that commit.

## Read-only

The backend module registers **nine GET routes and no other verb** — verified by
enumerating the router, not by convention. Every mutating control on every screen
is rendered and disabled, so the interface is reviewable now and does not change
shape when the endpoints arrive.

| Capability | Phase |
|---|---|
| Invite · suspend · role assignment | 14.4 |
| Permission enforcement (`usePermissions`, `AdminRoute`) | 14.4 |
| Mailbox reconnect · assignment · live probes | 14.7 |
| Full audit instrumentation | 14.7 |
| Organization record and editing | 14.3 |

## Layout

```
admin/
├── components/     18 reusable pieces + a barrel
├── constants/      navigation registry, role model, chart palette, vocabulary
├── hooks/          resource, table, breadcrumbs, debounce, element measurement
├── layouts/        AdminLayout — the shell
├── pages/          10 screens
├── routes/         adminPaths (registry) + adminRoutes (the branch)
├── services/       adminEndpoints (the API surface) + admin.service
└── utils/          display formatting, error interpretation
```

## Reused, unmodified

`ProtectedRoute` · `UserMenu` · `UserAvatar` · `StatusBadge` · `ErrorScreen` ·
`Button` · `Spinner` · `Skeleton` · `DashboardFooter` · `useAuth` · `useUi` ·
`httpClient` · `apiError` · the Tailwind theme tokens.

None were touched. The admin shell reuses the CRM's authentication, its HTTP
client and its design tokens, so there is exactly one answer to "who is signed
in" and the two surfaces read as one product.

## Known limits, stated in the interface

- **Scope is the deployment, not an organization.** There is no organization
  boundary until Phase 14.3, so every count covers the whole database. Each
  screen says so.
- **Any signed-in user can read these endpoints.** Role enforcement begins in
  Phase 14.4; the server refuses nothing beyond authentication today.
- **Mailbox health is inferred**, not probed — derived from connection status and
  the last recorded successful sync, because a live Graph call per mailbox would
  reach into the mailbox engine.
- **External-service health is inferred** from recorded sync outcomes and recent
  sign-ins, for the same reason.
- **Audit coverage is six actions.** The screen lists exactly which, because a
  log that silently omits role changes reads as a log saying none happened.
- **Billing is not part of this CRM** and has been removed entirely.
