# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Prayer Times Calendar Web App** - A modern Next.js web application that automatically syncs Islamic prayer times to users' Google Calendars with a beautiful glassmorphism UI featuring Islamic-themed design elements.

## Tech Stack

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + Custom glassmorphism
- shadcn/ui or Radix UI components
- Zustand or React Context for state management
- React Hook Form + Zod for form validation
- TanStack Query (React Query) for API calls
- Framer Motion for animations

**Backend/Serverless:**
- Next.js API routes (serverless functions)
- NextAuth.js with Google OAuth Provider
- PostgreSQL (Neon or Supabase) for user settings
- Prisma ORM
- Vercel Cron for automatic syncs

**External APIs:**
- Google Calendar API v3 (calendar management)
- Aladhan Prayer Times API (prayer time calculations)
- Geoapify Geocoding API (city search)

**Deployment:**
- Hosted on Vercel
- Automatic deployments from GitHub
- Vercel Analytics + Sentry for monitoring

## Architecture

This is a **serverless JAMstack** application:

1. **Frontend** (Next.js pages/components) handles UI and user interactions
2. **API Routes** (`/api/*`) act as serverless functions that:
   - Handle authentication (NextAuth)
   - Proxy external API calls (Google Calendar, Aladhan, Geoapify)
   - Manage user settings in PostgreSQL
   - Process calendar sync operations
3. **Database** stores only user settings, preferences, and sync logs (no prayer data)
4. **External APIs** are called from backend API routes to keep keys secure

## Key Architectural Decisions

### Security & Privacy
- **OAuth 2.0 with PKCE flow** for Google authentication
- **API keys never exposed** to frontend - all external API calls go through Next.js API routes
- **Minimal data storage** - prayer times are fetched on-demand, not stored
- **httpOnly cookies** for secure token storage
- HTTPS-only, CORS properly configured, CSP headers implemented

### Data Flow for Prayer Sync
1. User clicks "Sync Now" → triggers POST to `/api/calendar/sync`
2. API route fetches prayer times from Aladhan API using user's location and calculation method
3. API route checks Google Calendar for existing prayer events (duplicate prevention)
4. API route creates/updates events in user's selected Google Calendar with multiple reminders
5. API route logs sync status to PostgreSQL
6. Response sent back to frontend with success/error status

### Data Flow for Event Cleanup (Auto-Delete)
1. Vercel Cron triggers `/api/calendar/cleanup` hourly (or appropriate interval)
2. API route queries users with `autoDeleteEvents: true`
3. For each user, calculates deletion threshold based on `deleteEventsAfter` setting
4. Fetches prayer events from Google Calendar within deletion window
5. Batch deletes events that meet deletion criteria
6. Logs cleanup operations to PostgreSQL

### Glassmorphism Design System
- Background: `rgba(255, 255, 255, 0.1)` with `backdrop-blur: 10px`
- Border: `1px solid rgba(255, 255, 255, 0.2)`
- Border radius: `16px`
- Islamic patterns, mosque silhouettes, and geometric patterns as decorative elements
- Color palette: Islamic green (#0D9488), gold accent (#F59E0B), deep blue/purple gradient backgrounds

## Database Schema

### User Model
```typescript
{
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: Date;
  updatedAt: Date;
  settings: Settings; // One-to-one relation
}
```

### Settings Model
```typescript
{
  id: string;
  userId: string;
  location: {
    city: string;
    country: string;
    latitude: number;
    longitude: number;
  };
  calculationMethod: number; // 1-5 (ISNA, MWL, Umm Al-Qura, etc.)
  reminderMinutes: number[]; // Array of reminder times, e.g., [30, 15, 5] for 30min, 15min, 5min before
  selectedPrayers: string[]; // ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  targetCalendarId: string;
  eventTitleTemplate: string; // Custom title template with {prayer} placeholder, default: "{prayer} Prayer"
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly' | 'monthly';
  autoDeleteEvents: boolean; // Enable automatic deletion of past prayer events
  deleteEventsAfter: '30min' | 'end-of-day' | 'end-of-week' | 'end-of-month'; // When to delete events
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
```

### SyncLog Model
```typescript
{
  id: string;
  userId: string;
  timestamp: Date;
  status: 'success' | 'failure';
  eventsCreated: number;
  errorMessage?: string;
}
```

## API Routes Structure

- `/api/auth/*` - NextAuth.js authentication endpoints (signin, callback, signout, session)
- `/api/calendar/sync` - POST: Manually sync prayer times to Google Calendar
- `/api/calendar/list` - GET: List user's Google calendars
- `/api/calendar/create` - POST: Create dedicated "Prayer Times" calendar
- `/api/calendar/cleanup` - POST: Delete past prayer events based on user settings (triggered by cron or manually)
- `/api/prayers/times` - GET: Fetch prayer times from Aladhan API (params: lat, lon, method)
- `/api/cities/search` - GET: Search cities using Geoapify (param: q)
- `/api/settings` - GET/PUT/DELETE: Manage user settings
- `/api/logs` - GET: Retrieve sync history

## Environment Variables Required

```env
# Google OAuth (required)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database (required)
DATABASE_URL=

# External APIs (required)
GEOAPIFY_API_KEY=

# Monitoring (optional)
SENTRY_DSN=
```

## Development Commands

Since this is a Next.js project, standard commands will be:

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint

# Run tests (once configured)
npm test

# Run Prisma migrations
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Open Prisma Studio (database GUI)
npx prisma studio
```

## Key Implementation Notes

### Duplicate Prevention
When syncing prayer events, always check for existing events by:
1. Matching event title pattern using the user's custom template (e.g., if template is `{prayer} Prayer`, match "Fajr Prayer", "Dhuhr Prayer", etc.)
2. Matching date and time window (within ±5 minutes)
3. Update existing events if times changed instead of creating duplicates
4. If user changes the event title template, old events with previous titles should be detected and updated or cleaned up

### Calculation Methods
Support these 5 calculation methods (from Aladhan API):
1. ISNA (Islamic Society of North America)
2. Muslim World League
3. Umm Al-Qura (Saudi Arabia)
4. Egyptian General Authority
5. University of Islamic Sciences, Karachi

### Event Details Format
```typescript
{
  summary: eventTitleTemplate.replace('{prayer}', prayerName), // e.g., "Fajr Prayer" (default template: "{prayer} Prayer")
  description: `Prayer time calculated using [Method Name]\nLocation: [City, Country]`,
  start: { dateTime: ISO8601, timeZone: 'UTC' },
  end: { dateTime: ISO8601 + 15min, timeZone: 'UTC' },
  location: "[City, Country]",
  reminders: {
    useDefault: false,
    overrides: [
      { method: 'popup', minutes: 30 },
      { method: 'popup', minutes: 15 },
      { method: 'popup', minutes: 5 }
      // Multiple reminders from user's reminderMinutes array
    ]
  }
}
```

### Event Title Customization
Users can customize the event title using a template with a `{prayer}` placeholder:
- **Default template**: `{prayer} Prayer` → "Fajr Prayer", "Dhuhr Prayer", etc.
- **Custom examples**:
  - `🕌 {prayer}` → "🕌 Fajr", "🕌 Dhuhr"
  - `Time for {prayer}` → "Time for Fajr", "Time for Dhuhr"
  - `{prayer} - صلاة` → "Fajr - صلاة", "Dhuhr - صلاة"
- The `{prayer}` placeholder is replaced with the prayer name during event creation
- Template validation ensures `{prayer}` placeholder is present

### Auto-Delete Prayer Events
Users can configure automatic deletion of past prayer events to keep their calendar clean:

**Delete Timing Options:**
- **30 minutes after prayer** - Event deleted 30 min after the prayer time ends (e.g., Fajr at 5:30 AM deleted at 6:15 AM)
- **End of day** - All prayer events for the day deleted at 11:59 PM
- **End of week** - All prayer events for the week deleted on Sunday at 11:59 PM
- **End of month** - All prayer events for the month deleted on the last day at 11:59 PM

**Implementation:**
- Vercel Cron job runs `/api/calendar/cleanup` every hour (or appropriate interval)
- Cleanup logic:
  1. Query users with `autoDeleteEvents: true`
  2. For each user, fetch prayer events from Google Calendar
  3. Based on `deleteEventsAfter` setting, calculate which events should be deleted
  4. Delete events using Google Calendar API batch delete
  5. Log cleanup operations in SyncLog with type 'cleanup'
- Events are identified by title pattern `"[Prayer Name] Prayer"` and metadata
- Only deletes events created by the app (matched by description or extended properties)

### First-Time User Flow
1. Landing page with "Sign in with Google"
2. OAuth consent screen
3. Redirect to setup wizard (8 steps):
   - Welcome/explanation
   - Search and select city
   - Choose calculation method
   - Configure reminders (multiple reminders supported, e.g., 30, 15, 5 minutes before)
   - Customize event title (optional, default: "{prayer} Prayer")
   - Configure auto-delete preferences (enable/disable, select timing)
   - Select target calendar
   - Review settings and perform first sync
4. Redirect to dashboard

### Mobile-First Responsive Design
- Mobile: 375px - 767px (single column layout)
- Tablet: 768px - 1023px (two columns)
- Desktop: 1024px+ (three columns max)

## Testing Strategy

- **Unit tests**: All utility functions, API handlers, component logic
- **Integration tests**: OAuth flow, Calendar API integration, database operations
- **E2E tests** (Playwright): Complete user journey from signin → configure → sync
- Target: 80%+ test coverage

## Performance Requirements

- Initial page load: < 2 seconds
- API responses: < 1 second
- Calendar sync operation: < 5 seconds
- UI interactions: < 100ms (feel instant)
- Smooth animations: 60fps

## Accessibility Requirements

- WCAG 2.1 AA compliance
- Keyboard navigation support
- ARIA labels on all interactive elements
- Focus indicators visible
- Color contrast ratio 4.5:1 minimum
- Screen reader compatible

## Development Phases

**Phase 1 (MVP)**: Basic UI, Google OAuth, city search, manual sync, basic settings
**Phase 2**: Auto-sync scheduling, multiple calculation methods, calendar selection, reminders
**Phase 3**: Polish - animations, error handling, loading states, onboarding, accessibility
**Phase 4 (Future)**: Qibla direction, mosque finder, prayer tracking, multi-language, PWA

## Common Pitfalls to Avoid

1. **Never expose API keys in frontend code** - always proxy through `/api/*` routes
2. **Always validate user input** with Zod schemas before processing
3. **Check for duplicate events** before creating calendar entries
4. **Handle OAuth token refresh** automatically - don't let tokens expire silently
5. **Implement rate limiting** on API routes to prevent abuse
6. **Cache prayer times** appropriately - they don't change within a day
7. **Test with multiple timezones** - prayer times are timezone-sensitive
8. **Respect API rate limits**: Google Calendar (1M/day), Geoapify (3k/day)
9. **Only delete events created by the app** - use extended properties or description patterns to identify app-created events during cleanup
10. **Batch delete operations** when cleaning up events - use Google Calendar batch API to avoid rate limits

## Browser Compatibility

Support Chrome 90+, Firefox 88+, Safari 14+, Edge 90+, and modern mobile browsers (iOS Safari, Chrome Mobile).
