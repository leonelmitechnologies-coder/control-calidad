# Frontend Structure Verification

## Project Overview

React SPA frontend for Quality Control System with:
- OIDC authentication (Nextcloud)
- Multi-language support (en, es-MX, zh-CN)
- TanStack Query for data fetching
- Wouter for routing
- Tailwind CSS for styling

## Files Created

### Configuration Files

| File | Purpose |
|------|---------|
| `src/config/api.ts` | API endpoint definitions |
| `src/config/i18n.ts` | i18next initialization and setup |

### Internationalization

| File | Purpose |
|------|---------|
| `src/i18n/en.json` | English translations |
| `src/i18n/es-MX.json` | Spanish (Mexico) translations |
| `src/i18n/zh-CN.json` | Simplified Chinese translations |

**Key Translation Keys:**
- `app.title` — Application title
- `nav.*` — Navigation labels (dashboard, nc, recepciones, etc.)
- `auth.*` — Authentication strings
- `common.*` — Common UI strings
- `layout.*` — Layout component strings

### API & Authentication

| File | Purpose |
|------|---------|
| `src/api/auth.ts` | Authentication API functions |
| `src/hooks/useAuth.ts` | Custom hook for auth state (TanStack Query) |

**Functions Available:**
- `fetchCurrentUser()` — GET `/api/me`
- `logout()` — POST `/api/logout` + redirect
- `handleOIDCCallback()` — Process OIDC callback
- `redirectToLogin()` — Redirect to login
- `useAuth()` — Hook for auth state

### Pages (Module Stubs)

10 module pages created (all with placeholder content):

| Page | Route | File |
|------|-------|------|
| Dashboard | `/` | `src/pages/Dashboard.tsx` |
| No Conformities | `/nc` | `src/pages/NoConformidades.tsx` |
| Receptions | `/recepciones` | `src/pages/Recepciones.tsx` |
| External Rejects | `/rechazos-ext` | `src/pages/RechazosExternos.tsx` |
| Internal Rejects | `/rechazos-int` | `src/pages/RechazosInternos.tsx` |
| Corrective Actions | `/capas` | `src/pages/Capas.tsx` |
| AQL | `/aql` | `src/pages/Aql.tsx` |
| Shipping Release | `/liberacion-shipping` | `src/pages/LiberacionShipping.tsx` |
| Organization Chart | `/organigrama-qc` | `src/pages/OrganigramaQc.tsx` |
| Calendar | `/calendario` | `src/pages/Calendario.tsx` |

Additional:
- `src/pages/Login.tsx` — OIDC callback handler

### Components

| File | Purpose |
|------|---------|
| `src/components/Layout.tsx` | Main layout with sidebar, header, nav |

**Layout Features:**
- Fixed left sidebar (264px wide)
- Logo + app title in header
- 10 navigation items with icons + i18n labels
- Language selector dropdown (es-MX, en, zh-CN)
- User profile section with avatar
- Logout button

### Core App Files

| File | Purpose |
|------|---------|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Main app component with routing |
| `src/index.css` | Global styles + Tailwind |
| `index.html` | HTML template |

### Updated Files

| File | Change |
|------|--------|
| `.env.example` | Added `VITE_API_URL` |

## TypeScript Structure

All files are **strict TypeScript** with:
- Interfaces for props and API responses
- Type-safe hooks
- No implicit `any`
- JSX strict mode

### Example Type Definitions

```typescript
// User type (src/api/auth.ts)
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Navigation item type (src/components/Layout.tsx)
interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

// Layout props
interface LayoutProps {
  children: ReactNode;
}

// Auth return type
interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: Error | null;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}
```

## Routing Structure

Uses **wouter** for lightweight routing:

```
/login                    → Login component (OIDC callback)
/                         → Layout + Dashboard
/nc                       → Layout + NoConformidades
/recepciones              → Layout + Recepciones
/rechazos-ext             → Layout + RechazosExternos
/rechazos-int             → Layout + RechazosInternos
/capas                    → Layout + Capas
/aql                      → Layout + Aql
/liberacion-shipping      → Layout + LiberacionShipping
/organigrama-qc           → Layout + OrganigramaQc
/calendario               → Layout + Calendario
/*                        → Catch-all → redirect to /
```

## Authentication Flow

### Current (Phase 1A)

1. App loads → `useAuth` hook fetches `GET /api/me`
2. If 401 → user not authenticated
3. `Layout` component checks `isAuthenticated`
4. If false → calls `redirectToLogin()`
5. Redirects to `/api/auth/login`

### Future (Phase 1B - OIDC)

1. User clicks "Login"
2. Redirected to `/api/auth/login` (Nextcloud OIDC provider)
3. After auth, Nextcloud redirects to `/login?code=...&state=...`
4. `Login` page component processes callback
5. `handleOIDCCallback()` POSTs to `/api/auth/callback`
6. Session cookie set by server
7. Redirect to `/` (dashboard)

## i18n Implementation

### Setup (src/config/i18n.ts)

- i18next + react-i18next
- Default language: `es-MX`
- Falls back to: `es-MX` if key missing
- Language persisted in `localStorage`

### Usage in Components

```tsx
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('nav.dashboard')}</h1>
      <select onChange={(e) => i18n.changeLanguage(e.target.value)}>
        <option value="es-MX">Español</option>
        <option value="en">English</option>
        <option value="zh-CN">中文</option>
      </select>
    </div>
  );
}
```

### Language Keys

All three language files (`en.json`, `es-MX.json`, `zh-CN.json`) have identical keys:

**App Section:**
- `app.title` — App title
- `app.subtitle` — Subtitle

**Navigation Section:**
- `nav.dashboard`
- `nav.nc`
- `nav.recepciones`
- `nav.rechazos_ext`
- `nav.rechazos_int`
- `nav.capas`
- `nav.aql`
- `nav.liberacion_shipping`
- `nav.organigrama`
- `nav.calendario`

**Auth Section:**
- `auth.login`
- `auth.logout`
- `auth.loginRequired`
- `auth.user`

**Common Section:**
- `common.loading`
- `common.error`
- `common.success`
- `common.delete_confirm`
- `common.cancel`
- `common.delete`
- `common.save`
- `common.edit`
- `common.close`

**Layout Section:**
- `layout.menu`
- `layout.language`

## Data Fetching (TanStack Query)

### Configuration

- **staleTime**: 5 minutes (300,000 ms)
- **retry**: 1 attempt on failure
- **useSuspense**: false (handled manually)

### Example Usage

```tsx
import { useQuery } from '@tanstack/react-query';

function MyComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['modules', 'dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/summary');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}
```

## Styling Approach

- **Framework**: Tailwind CSS (no component library)
- **Colors**: Theme-aware CSS variables (HSL)
- **Dark Mode**: Supported (class-based)
- **Responsive**: Mobile-first breakpoints
- **Custom Config**: `tailwind.config.ts`

### Color Variables

```css
--background, --foreground, --primary, --secondary, 
--muted, --accent, --destructive, --card, --border, --input
```

All as HSL values in `src/index.css`.

## Browser Compatibility

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- Mobile browsers: Latest versions

No IE11 support (ES2022 target).

## Performance Optimizations

1. **Code Splitting**: Lazy routes possible with Suspense
2. **Query Caching**: TanStack Query caches responses
3. **Memoization**: Components use React.memo when needed
4. **Tree Shaking**: Unused imports removed at build
5. **CSS**: Tailwind purges unused styles

## Next Steps (Phase 1B)

1. **Server OIDC Setup**
   - Integrate Nextcloud OIDC provider
   - Implement `/api/auth/login` endpoint
   - Implement `/api/auth/callback` endpoint
   - Implement `/api/me` endpoint
   - Add session/cookie handling

2. **Module Implementation**
   - Replace placeholder components with real forms
   - Add API calls for each module
   - Add data tables and CRUD operations
   - Add validation and error handling

3. **Testing**
   - Add unit tests (Vitest)
   - Add component tests (Testing Library)
   - Add E2E tests (Playwright)

4. **Additional Features**
   - Export to PDF (server-side with Puppeteer)
   - File uploads (images for modules)
   - Real-time updates (WebSocket)
   - Search/filtering UI
   - Date pickers, form validation

## File Checklist

✅ `src/config/api.ts`
✅ `src/config/i18n.ts`
✅ `src/i18n/en.json`
✅ `src/i18n/es-MX.json`
✅ `src/i18n/zh-CN.json`
✅ `src/api/auth.ts`
✅ `src/hooks/useAuth.ts`
✅ `src/components/Layout.tsx`
✅ `src/pages/Dashboard.tsx`
✅ `src/pages/NoConformidades.tsx`
✅ `src/pages/Recepciones.tsx`
✅ `src/pages/RechazosExternos.tsx`
✅ `src/pages/RechazosInternos.tsx`
✅ `src/pages/Capas.tsx`
✅ `src/pages/Aql.tsx`
✅ `src/pages/LiberacionShipping.tsx`
✅ `src/pages/OrganigramaQc.tsx`
✅ `src/pages/Calendario.tsx`
✅ `src/pages/Login.tsx`
✅ `src/App.tsx`
✅ `src/main.tsx`
✅ `index.html`
✅ `.env.example` (updated)

## Running the App

```bash
# Install dependencies
npm install

# Development (client + server)
npm run dev

# Client only
npm run dev:client

# Build
npm run build

# Type check
npm run typecheck
```

## API Environment Variables

Set in `.env` or `.env.local`:

```
VITE_API_URL=http://localhost:3001
```

Default: `http://localhost:3001`

---

**Date Created**: 2026-06-29
**Status**: Phase 1A Complete
**Next Phase**: Phase 1B (Server OIDC + Module APIs)
