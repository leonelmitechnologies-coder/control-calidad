# Client Setup Guide

## Overview

This is the React frontend for the Quality Control System (Sistema de Control de Calidad). The client is built with:

- **React 18** — UI library
- **TypeScript** — Type safety
- **Wouter** — Lightweight routing
- **TanStack Query (React Query)** — Data fetching and caching
- **react-i18next** — Internationalization (i18n)
- **Tailwind CSS** — Styling
- **Vite** — Build tool

## Environment Setup

### Prerequisites

- Node.js >= 20
- npm or yarn

### Installation

1. Install dependencies from the root directory:
   ```bash
   npm install
   ```

2. Create `.env` file with:
   ```
   VITE_API_URL=http://localhost:3001
   ```

## Development

### Start Development Server

Run both client and server concurrently:
```bash
npm run dev
```

This starts:
- **Client**: Vite dev server on `http://localhost:5173`
- **Server**: Node.js server on `http://localhost:3001`

### Build for Production

```bash
npm run build:client
```

Output will be in `dist/client/`

## Project Structure

```
client/
├── src/
│   ├── api/
│   │   └── auth.ts                 # Authentication API functions
│   ├── components/
│   │   └── Layout.tsx              # Main layout with sidebar + header
│   ├── config/
│   │   ├── api.ts                  # API endpoint configuration
│   │   └── i18n.ts                 # i18n setup
│   ├── hooks/
│   │   └── useAuth.ts              # Authentication hook with TanStack Query
│   ├── i18n/
│   │   ├── en.json                 # English translations
│   │   ├── es-MX.json              # Spanish (Mexico) translations
│   │   └── zh-CN.json              # Simplified Chinese translations
│   ├── pages/
│   │   ├── Dashboard.tsx           # Main dashboard
│   │   ├── NoConformidades.tsx
│   │   ├── Recepciones.tsx
│   │   ├── RechazosExternos.tsx
│   │   ├── RechazosInternos.tsx
│   │   ├── Capas.tsx
│   │   ├── Aql.tsx
│   │   ├── LiberacionShipping.tsx
│   │   ├── OrganigramaQc.tsx
│   │   ├── Calendario.tsx
│   │   └── Login.tsx               # OIDC callback handler
│   ├── App.tsx                     # Main app component with routing
│   ├── main.tsx                    # React entry point
│   └── index.css                   # Tailwind + global styles
├── index.html                      # HTML template
└── vite.config.ts                  # Vite configuration
```

## Key Features

### 1. Internationalization (i18n)

Three languages supported out of the box:
- **es-MX** — Spanish (Mexico) [default]
- **en** — English
- **zh-CN** — Simplified Chinese

Language switching in the sidebar updates the UI instantly. Selection is persisted to `localStorage`.

### 2. Authentication

The `useAuth` hook integrates with the backend OIDC (OpenID Connect) provider:

```tsx
import { useAuth } from '@client/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <div>Not logged in</div>;
  
  return <div>Welcome, {user.name}</div>;
}
```

**Current Implementation:**
- `useAuth` fetches from `GET /api/me` on mount
- Data is cached for 5 minutes
- Retries once on failure
- Returns `null` if not authenticated (401)

**Future OIDC Flow:**
- Server implements Nextcloud OIDC provider
- Login redirects to `/api/auth/login` (Nextcloud)
- Callback handler at `/login` route processes `code` + `state`
- Session persisted via cookies

### 3. Routing

Routes use **wouter** (lightweight alternative to React Router):

```tsx
<Router>
  <Route path="/" component={Dashboard} />
  <Route path="/nc" component={NoConformidades} />
  {/* ... */}
</Router>
```

All module routes are automatically prefixed with `/` and include sidebar navigation.

### 4. Data Fetching

**TanStack Query** (React Query) for server state:

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['modules', 'dashboard'],
  queryFn: () => fetch('/api/dashboard/summary').then(r => r.json()),
  staleTime: 1000 * 60 * 5,
});
```

Queries are automatically:
- Cached
- Retried on failure
- Invalidated via mutation patterns

### 5. Styling

**Tailwind CSS** with custom design tokens:
- Dark mode support (class-based)
- Custom color variables (HSL)
- Responsive design

All colors are theme-aware via CSS custom properties.

## Common Tasks

### Add a New Page

1. Create component in `src/pages/`:
   ```tsx
   export default function MyPage() {
     return <h1>My Page</h1>;
   }
   ```

2. Import and add route in `src/App.tsx`:
   ```tsx
   import MyPage from './pages/MyPage';
   
   <Route path="/my-route">
     {() => <Layout><MyPage /></Layout>}
   </Route>
   ```

3. Add nav item in `src/components/Layout.tsx`:
   ```tsx
   const navItems: NavItem[] = [
     // ...
     { label: 'My Page', href: '/my-route', icon: '📄' },
   ];
   ```

4. Add translations in `src/i18n/*.json`:
   ```json
   {
     "nav": {
       "my_route": "My Page"
     }
   }
   ```

### Add an API Endpoint

1. Define in `src/config/api.ts`:
   ```tsx
   export const API_ENDPOINTS = {
     myModule: {
       list: `${API_BASE_URL}/api/my-module`,
     },
   };
   ```

2. Create a query function:
   ```tsx
   // src/api/myModule.ts
   export async function fetchMyModule() {
     const res = await fetch(API_ENDPOINTS.myModule.list);
     return res.json();
   }
   ```

3. Use with `useQuery`:
   ```tsx
   const { data } = useQuery({
     queryKey: ['myModule'],
     queryFn: fetchMyModule,
   });
   ```

### Add Translation Keys

1. Add key to all three files:
   ```json
   // src/i18n/en.json
   {
     "myModule": {
       "title": "My Module"
     }
   }
   ```

2. Use in component:
   ```tsx
   import { useTranslation } from 'react-i18next';
   
   const { t } = useTranslation();
   <h1>{t('myModule.title')}</h1>
   ```

## Deployment

### Build

```bash
npm run build
```

This runs:
- `npm run build:client` — Vite builds to `dist/client/`
- `npm run build:server` — TypeScript compiles server

### Environment Variables

For production, set:
- `VITE_API_URL` — Backend API URL (e.g., `https://api.example.com`)

## Debugging

### React DevTools

Install [React DevTools](https://react-devtools-tutorial.vercel.app/) browser extension.

### React Query DevTools

The package includes `@tanstack/react-query`, which has optional DevTools:

```bash
npm install -D @tanstack/react-query-devtools
```

Then add to `App.tsx`:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* ... */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Network Inspection

Check browser DevTools → Network tab to see:
- API requests
- Authentication flow
- OIDC callback parameters

## Notes

- **No framework lock-in:** Wouter is lightweight and replaceable
- **Minimal dependencies:** Only essential packages (React, React Query, i18next)
- **TypeScript strict mode:** All code is type-safe
- **CSS-in-JS avoided:** Pure Tailwind for styling
- **Responsive design:** Mobile-first approach with Tailwind breakpoints

## Troubleshooting

### "Cannot find module" errors

Run `npm install` again and restart the dev server.

### Translations not loading

Check that `localStorage.language` is set correctly. Defaults to `'es-MX'`.

### API requests failing (401)

User is not authenticated. Redirect to login with `redirectToLogin()`.

### Styling broken

Ensure `index.css` is imported in `main.tsx` and Tailwind CSS is installed.

---

For API and backend documentation, see the main `README.md`.
