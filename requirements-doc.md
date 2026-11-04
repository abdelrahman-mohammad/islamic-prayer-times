# Prayer Times Calendar Web App - Requirements Document

**Version:** 1.0  
**Date:** November 11, 2025  
**Project Type:** Web Application  
**Target Platform:** Browser-based (Desktop & Mobile)

---

## 1. Executive Summary

### 1.1 Purpose
A modern web application that automatically syncs Islamic prayer times to users' Google Calendars based on their location, featuring a beautiful glassmorphism UI with Islamic-themed design elements.

### 1.2 Goals
- Provide an elegant, user-friendly interface for prayer time calendar integration
- Eliminate manual entry of prayer times
- Support multiple calculation methods for different madhabs
- Create a visually stunning experience with glassmorphism and Islamic design patterns
- Ensure mobile-first responsive design
- Maintain data privacy and security

### 1.3 Target Users
- Muslims worldwide who use Google Calendar
- Users seeking automated prayer time reminders
- Tech-savvy Muslims looking for modern Islamic tools

---

## 2. Functional Requirements

### 2.1 User Authentication

**FR-AUTH-001: Google OAuth Integration**
- Users must authenticate via Google OAuth 2.0
- App requests minimal required scopes: calendar events read/write
- Session management with refresh tokens
- Support "Sign in with Google" button
- Handle authentication errors gracefully

**FR-AUTH-002: Session Management**
- Remember user login state
- Auto-refresh expired tokens
- Logout functionality
- Clear session data on logout

### 2.2 Location Management

**FR-LOC-001: City Search**
- Search for cities worldwide using Geoapify API
- Display search results with country information
- Show city population for context
- Support search in English and local languages
- Minimum 2 characters to trigger search
- Display up to 10 results

**FR-LOC-002: Location Selection**
- Select city from search results
- Auto-populate coordinates (latitude/longitude)
- Display selected city prominently
- Option to change/update location
- Save location preference per user

**FR-LOC-003: Automatic Location Detection (Optional)**
- Use browser geolocation API with user permission
- Reverse geocode to get city name
- Confirm location before applying
- Fallback to manual search if denied

### 2.3 Prayer Time Configuration

**FR-PRAY-001: Calculation Methods**
- Support multiple calculation methods:
  - ISNA (Islamic Society of North America)
  - Muslim World League
  - Umm Al-Qura (Saudi Arabia)
  - Egyptian General Authority
  - University of Islamic Sciences, Karachi
  - Custom methods (future enhancement)
- Default to ISNA or user's previous selection
- Explain differences between methods

**FR-PRAY-002: Prayer Selection**
- All 5 daily prayers by default: Fajr, Dhuhr, Asr, Maghrib, Isha
- Option to toggle individual prayers on/off
- Option to include Sunrise and Sunset times
- Save preferences per user

**FR-PRAY-003: Reminder Settings**
- Configure multiple reminder times (minutes before prayer)
- Default: [30] minutes before
- Users can add multiple reminders (e.g., 30, 15, 5 minutes before)
- Support for unlimited number of reminders per prayer
- Each reminder creates a popup notification in Google Calendar
- Option for notification types (popup, email)

### 2.4 Calendar Sync

**FR-SYNC-001: Manual Sync**
- "Sync Now" button to immediately add prayer times
- Sync current day's prayers
- Visual feedback during sync (loading state)
- Success/error notifications

**FR-SYNC-002: Automatic Sync**
- Configure automatic sync frequency:
  - Daily (recommended)
  - Weekly
  - Monthly
- Sync runs at specified time (e.g., 1 AM)
- Email notification if sync fails

**FR-SYNC-003: Calendar Selection**
- List user's calendars
- Select target calendar (default: primary)
- Option to create dedicated "Prayer Times" calendar
- Remember selection

**FR-SYNC-004: Duplicate Prevention**
- Check for existing prayer events before creating
- Match by title and time
- Update existing events if times change
- Don't create duplicates

**FR-SYNC-005: Event Details**
- Event title: Customizable with template (default: "{prayer} Prayer")
  - Users can customize title format using `{prayer}` placeholder
  - Examples: "🕌 {prayer}", "Time for {prayer}", "{prayer} - صلاة"
  - Placeholder `{prayer}` is replaced with actual prayer name (Fajr, Dhuhr, etc.)
  - Validation ensures `{prayer}` placeholder is present in template
- Duration: 15 minutes default
- Description: Include prayer info, calculation method
- Location: User's city name
- Color coding per prayer type (if supported)
- Multiple reminders attached based on user preferences

**FR-SYNC-006: Event Cleanup (Auto-Delete)**
- Option to automatically delete past prayer events
- Delete timing options:
  - 30 minutes after prayer time ends
  - End of day (11:59 PM)
  - End of week (Sunday 11:59 PM)
  - End of month (last day 11:59 PM)
- Only deletes events created by this app
- Runs via scheduled cron job
- Logs all cleanup operations
- User can enable/disable this feature
- Helps keep calendar clean and organized

### 2.5 User Dashboard

**FR-DASH-001: Today's Prayer Times**
- Display today's prayer times prominently
- Highlight next upcoming prayer
- Show countdown to next prayer
- Display hijri date

**FR-DASH-002: Settings Overview**
- Show current location
- Show calculation method
- Show sync status (last synced, next sync)
- Quick access to edit settings

**FR-DASH-003: Activity Log**
- Recent sync history
- Success/failure status
- Number of events created
- Last 10 syncs displayed

### 2.6 Settings Management

**FR-SET-001: Profile Settings**
- View Google account info
- Manage calendar permissions
- Export settings as JSON

**FR-SET-002: API Key Management**
- Enter/update Geoapify API key
- Validate API key
- Show masked key for security
- Instructions for obtaining free key

**FR-SET-003: Preferences**
- Theme selection (light/dark/auto)
- Language preference (English, Arabic, more)
- Notification preferences
- Time format (12h/24h)
- Event title template customization
  - Input field with `{prayer}` placeholder
  - Default: "{prayer} Prayer"
  - Real-time preview showing how title will appear
  - Validation to ensure `{prayer}` placeholder exists

---

## 3. Non-Functional Requirements

### 3.1 Performance

**NFR-PERF-001: Load Time**
- Initial page load < 2 seconds
- API responses < 1 second
- Calendar sync < 5 seconds

**NFR-PERF-002: Responsiveness**
- UI interactions feel instant (< 100ms)
- Smooth animations (60fps)
- No janky scrolling

### 3.2 Usability

**NFR-USE-001: Design**
- Glassmorphism UI with Islamic patterns
- Blurred background images (mosques, Islamic architecture)
- Frosted glass effect on cards
- Subtle animations and transitions
- Responsive design (mobile-first)
- WCAG 2.1 AA accessibility compliance

**NFR-USE-002: User Experience**
- Maximum 3 clicks to complete any task
- Clear call-to-action buttons
- Helpful error messages
- Tooltips for complex features
- Onboarding flow for first-time users

### 3.3 Security

**NFR-SEC-001: Authentication**
- OAuth 2.0 with PKCE flow
- Secure token storage (httpOnly cookies)
- HTTPS only
- No API keys exposed in frontend

**NFR-SEC-002: Data Privacy**
- No storage of prayer data on server
- Minimal user data collection
- Clear privacy policy
- GDPR compliant
- Option to delete all data

**NFR-SEC-003: API Security**
- Rate limiting per user
- Input validation and sanitization
- CORS properly configured
- CSP headers implemented

### 3.4 Reliability

**NFR-REL-001: Availability**
- 99.5% uptime target
- Graceful degradation if APIs fail
- Retry logic for failed requests
- Offline detection and messaging

**NFR-REL-002: Error Handling**
- User-friendly error messages
- Automatic error reporting (Sentry)
- Fallback UI for errors
- Detailed logs for debugging

### 3.5 Scalability

**NFR-SCALE-001: User Growth**
- Support 10,000+ concurrent users
- Serverless architecture for auto-scaling
- CDN for static assets
- Database optimization

### 3.6 Compatibility

**NFR-COMP-001: Browsers**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)

**NFR-COMP-002: Devices**
- Desktop (1920x1080 and down)
- Tablet (768px and up)
- Mobile (375px and up)
- Touch and mouse/keyboard input

### 3.7 Maintainability

**NFR-MAIN-001: Code Quality**
- TypeScript for type safety
- ESLint and Prettier configured
- 80%+ test coverage
- Component-based architecture
- Clear documentation

---

## 4. Technical Requirements

### 4.1 Technology Stack

**Frontend:**
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS + Custom glassmorphism
- UI Components: shadcn/ui or Radix UI
- State Management: Zustand or React Context
- Forms: React Hook Form + Zod validation
- API Client: TanStack Query (React Query)
- Animations: Framer Motion

**Backend/Serverless:**
- Platform: Vercel (Next.js API routes)
- Authentication: NextAuth.js with Google Provider
- Database: PostgreSQL (Neon or Supabase) for user settings
- ORM: Prisma
- Cron Jobs: Vercel Cron for automatic syncs

**External APIs:**
- Google Calendar API v3
- Aladhan Prayer Times API
- Geoapify Geocoding API

**DevOps:**
- Hosting: Vercel
- Version Control: Git/GitHub
- CI/CD: Vercel automatic deployments
- Monitoring: Vercel Analytics + Sentry
- Environment Variables: Vercel env vars

### 4.2 Architecture

**Architecture Pattern:** Serverless JAMstack

```
┌─────────────────────────────────────────────┐
│           Frontend (Next.js)                │
│  ┌──────────────────────────────────────┐   │
│  │  React Components (Glassmorphism)    │   │
│  │  - Auth Flow                         │   │
│  │  - Dashboard                         │   │
│  │  - Settings                          │   │
│  │  - City Search                       │   │
│  └──────────────────────────────────────┘   │
│              ↓                               │
│  ┌──────────────────────────────────────┐   │
│  │  Next.js API Routes (Serverless)     │   │
│  │  - /api/auth (NextAuth)              │   │
│  │  - /api/calendar/sync                │   │
│  │  - /api/cities/search                │   │
│  │  - /api/prayers/times                │   │
│  │  - /api/settings                     │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              ↓         ↓         ↓
    ┌─────────────┐ ┌──────────┐ ┌─────────────┐
    │  Google     │ │ Aladhan  │ │  Geoapify   │
    │  Calendar   │ │   API    │ │     API     │
    │     API     │ │          │ │             │
    └─────────────┘ └──────────┘ └─────────────┘
              ↓
    ┌─────────────────────┐
    │    PostgreSQL       │
    │  (User Settings)    │
    │  - user_id          │
    │  - location         │
    │  - preferences      │
    │  - sync_schedule    │
    └─────────────────────┘
```

### 4.3 Data Models

**User:**
```typescript
{
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  createdAt: Date;
  updatedAt: Date;
  settings: Settings;
}
```

**Settings:**
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
  calculationMethod: number; // 1-5
  reminderMinutes: number[]; // Array: [30, 15, 5] for multiple reminders
  selectedPrayers: string[]; // ['Fajr', 'Dhuhr', ...]
  targetCalendarId: string;
  eventTitleTemplate: string; // Default: "{prayer} Prayer"
  autoSync: boolean;
  syncFrequency: 'daily' | 'weekly' | 'monthly';
  autoDeleteEvents: boolean; // Enable auto-delete
  deleteEventsAfter: '30min' | 'end-of-day' | 'end-of-week' | 'end-of-month';
  theme: 'light' | 'dark' | 'auto';
  language: string;
}
```

**SyncLog:**
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

### 4.4 API Endpoints

**Authentication:**
- `GET /api/auth/signin` - Initiate Google OAuth
- `GET /api/auth/callback` - OAuth callback
- `GET /api/auth/signout` - Logout
- `GET /api/auth/session` - Get current session

**Calendar:**
- `POST /api/calendar/sync` - Manually sync prayers
- `GET /api/calendar/list` - List user's calendars
- `POST /api/calendar/create` - Create "Prayer Times" calendar
- `POST /api/calendar/cleanup` - Delete past prayer events (cron triggered)

**Prayers:**
- `GET /api/prayers/times?lat={lat}&lon={lon}&method={method}` - Get prayer times

**Cities:**
- `GET /api/cities/search?q={query}` - Search cities

**Settings:**
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings
- `DELETE /api/settings` - Delete all user data

**Sync Logs:**
- `GET /api/logs` - Get sync history

### 4.5 Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Database
DATABASE_URL=

# External APIs
GEOAPIFY_API_KEY=

# Monitoring
SENTRY_DSN=
```

---

## 5. User Interface Design

### 5.1 Design System

**Color Palette:**
- Primary: Islamic green (#0D9488, #14B8A6)
- Secondary: Gold accent (#F59E0B, #FBBF24)
- Background: Deep blue/purple gradient
- Glass: rgba(255, 255, 255, 0.1) with backdrop blur
- Text: White/off-white for dark backgrounds

**Typography:**
- Primary Font: Inter or Poppins (modern, clean)
- Arabic Font: Amiri or Scheherazade (if Arabic support)
- Headings: Bold, size 24-48px
- Body: Regular, size 14-16px

**Glassmorphism Specs:**
- Background: rgba(255, 255, 255, 0.1)
- Backdrop blur: 10px
- Border: 1px solid rgba(255, 255, 255, 0.2)
- Shadow: 0 8px 32px rgba(0, 0, 0, 0.37)
- Border radius: 16px

**Islamic Patterns:**
- Geometric patterns as overlays
- Mosque silhouettes in background
- Crescent moon and star motifs
- Arabesque decorative elements
- Respectful, elegant imagery

### 5.2 Key Pages/Screens

**1. Landing Page (Unauthenticated)**
- Hero section with glassmorphism card
- App description and benefits
- "Sign in with Google" CTA button
- Features showcase
- Screenshots/demo
- Footer with links

**2. Dashboard (Post-Auth)**
- Top: Greeting + Hijri date
- Hero card: Next prayer countdown (large, prominent)
- Today's prayer times grid (5 cards with glassmorphism)
- Quick actions: Sync Now, Edit Settings
- Recent activity/sync status
- Islamic quote of the day (optional)

**3. Settings Page**
- Tabbed interface or accordion
- Location settings (search + selected city)
- Prayer preferences (method, reminders)
- Calendar selection
- Sync schedule
- Account settings
- Danger zone (delete data)

**4. Setup Wizard (First-Time User)**
- Step 1: Welcome + explanation
- Step 2: Search and select city
- Step 3: Choose calculation method
- Step 4: Configure reminders (add multiple reminders)
- Step 5: Customize event title (optional, with preview)
- Step 6: Configure auto-delete preferences
- Step 7: Select calendar
- Step 8: Review and sync

**5. City Search Modal**
- Search input with real-time results
- Results displayed as cards
- Show city, country, population
- Select button per result
- Close/cancel option

### 5.3 Responsive Breakpoints

- Mobile: 375px - 767px (single column)
- Tablet: 768px - 1023px (two columns)
- Desktop: 1024px+ (three columns max)

### 5.4 Accessibility

- Keyboard navigation support
- ARIA labels on all interactive elements
- Focus indicators
- Screen reader compatible
- Color contrast ratio 4.5:1 minimum
- Alt text for all images

---

## 6. User Stories

### Epic 1: Authentication
- **US-001:** As a user, I want to sign in with my Google account so that I can securely access the app
- **US-002:** As a user, I want to stay logged in so that I don't have to sign in every time
- **US-003:** As a user, I want to log out so that I can protect my privacy on shared devices

### Epic 2: Location Setup
- **US-004:** As a user, I want to search for my city so that I can set my location
- **US-005:** As a user, I want to see my city clearly displayed so that I know my location is correct
- **US-006:** As a user, I want to change my location so that I can update prayer times when I travel

### Epic 3: Prayer Configuration
- **US-007:** As a user, I want to choose a calculation method so that prayer times match my madhab
- **US-008:** As a user, I want to set reminder times so that I get notified before prayers
- **US-009:** As a user, I want to toggle individual prayers so that I only sync the ones I need

### Epic 4: Calendar Integration
- **US-010:** As a user, I want to sync prayer times to my calendar so that they appear automatically
- **US-011:** As a user, I want to choose which calendar to use so that I can organize my events
- **US-012:** As a user, I want automatic daily syncs so that I don't have to manually update
- **US-013:** As a user, I want to set multiple reminders for each prayer so that I get notified at different intervals
- **US-014:** As a user, I want past prayer events automatically deleted so that my calendar stays clean
- **US-015:** As a user, I want to customize how prayer events are titled so that I can personalize my calendar

### Epic 5: Dashboard
- **US-016:** As a user, I want to see today's prayer times so that I know when to pray
- **US-017:** As a user, I want to see a countdown to the next prayer so that I can prepare
- **US-018:** As a user, I want to see my sync history so that I know the app is working

---

## 7. Success Metrics (KPIs)

### 7.1 User Engagement
- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- User retention rate (30-day)
- Average session duration
- Feature usage rates

### 7.2 Technical Performance
- Page load time (p50, p95)
- API response time
- Error rate
- Uptime percentage
- Sync success rate

### 7.3 Business Metrics
- User sign-ups per day
- Conversion rate (visitor → sign-up)
- Time to first sync
- User satisfaction score (survey)

---

## 8. Development Phases

### Phase 1: MVP (Weeks 1-3)
- ✅ Basic UI with glassmorphism
- ✅ Google OAuth login
- ✅ City search
- ✅ Manual prayer time sync
- ✅ Basic settings

### Phase 2: Core Features (Weeks 4-6)
- ✅ Automatic sync scheduling
- ✅ Multiple calculation methods
- ✅ Calendar selection
- ✅ Reminder configuration
- ✅ Mobile responsive design

### Phase 3: Polish (Weeks 7-8)
- ✅ Animations and transitions
- ✅ Error handling improvements
- ✅ Loading states
- ✅ User onboarding
- ✅ Accessibility improvements

### Phase 4: Advanced Features (Future)
- 🔮 Qibla direction
- 🔮 Mosque finder
- 🔮 Prayer tracking/statistics
- 🔮 Multi-language support
- 🔮 PWA (offline support)
- 🔮 Browser notifications

### Phase 5: Calendar Management Enhancements
- ✅ Multiple reminders per prayer (configurable)
- ✅ Auto-delete past prayer events (with timing options)
- ✅ Batch operations for cleanup
- ✅ Enhanced event metadata for tracking
- ✅ Customizable event titles with {prayer} placeholder

---

## 9. Risks and Mitigations

### Risk 1: Google API Rate Limits
- **Mitigation:** Implement caching, batch operations, monitor usage

### Risk 2: Prayer Time API Downtime
- **Mitigation:** Cache recent times, fallback calculations, error notifications

### Risk 3: User Privacy Concerns
- **Mitigation:** Clear privacy policy, minimal data collection, easy data deletion

### Risk 4: Performance on Mobile
- **Mitigation:** Code splitting, lazy loading, optimized images, CDN

### Risk 5: OAuth Token Expiry
- **Mitigation:** Automatic token refresh, clear re-auth flow

---

## 10. Testing Strategy

### 10.1 Unit Tests
- All utility functions
- API route handlers
- Component logic

### 10.2 Integration Tests
- OAuth flow
- Calendar API integration
- Database operations

### 10.3 E2E Tests (Playwright)
- Complete user journey
- Sign in → Configure → Sync
- Mobile and desktop flows

### 10.4 Manual Testing
- Cross-browser testing
- Accessibility testing
- UI/UX testing
- Performance testing

---

## 11. Deployment Strategy

### 11.1 Environments
- **Development:** Local (localhost:3000)
- **Staging:** Vercel preview deployments
- **Production:** Vercel production (custom domain)

### 11.2 CI/CD Pipeline
1. Push to GitHub
2. Automatic Vercel build
3. Run tests
4. Deploy to preview (PR) or production (main)
5. Smoke tests on deployed URL

### 11.3 Rollback Plan
- Instant rollback via Vercel UI
- Keep 10 previous deployments available
- Database migrations reversible

---

## 12. Future Enhancements

### High Priority
- Multi-language support (Arabic, Urdu, Turkish, etc.)
- Progressive Web App (PWA) for offline access
- Browser push notifications
- Qibla direction compass

### Medium Priority
- Prayer time adjustments (add/subtract minutes)
- Adhan audio notifications
- Islamic calendar with events
- Mosque finder with prayer times

### Low Priority
- Prayer tracking/statistics
- Community features (share with family)
- Tasbih counter integration
- Quran verse of the day

---

## 13. Compliance and Legal

### 13.1 Privacy Policy
- Data collection transparency
- Cookie policy
- Third-party services disclosure
- User rights (GDPR)

### 13.2 Terms of Service
- Acceptable use
- Service availability disclaimer
- Intellectual property
- Limitation of liability

### 13.3 Google OAuth Compliance
- Follow Google branding guidelines
- Privacy policy link visible
- Scopes clearly explained
- Annual security assessment

---

## 14. Documentation Deliverables

### For Developers
- README with setup instructions
- API documentation
- Component library docs
- Architecture diagrams
- Database schema

### For Users
- Getting started guide
- FAQs
- Troubleshooting guide
- Video tutorials (optional)

### For Stakeholders
- Project timeline
- Budget breakdown
- Progress reports
- Analytics dashboards

---

## 15. Support and Maintenance

### 15.1 User Support
- FAQ section
- Contact form
- Email support (response within 24h)
- Community Discord/forum (optional)

### 15.2 Maintenance Plan
- Weekly dependency updates
- Monthly security audits
- Quarterly feature releases
- Annual Google OAuth review

---

## Appendix A: API Rate Limits

| API | Free Tier Limit | Notes |
|-----|----------------|-------|
| Google Calendar | 1M requests/day | Per project |
| Aladhan | Unlimited | Fair use policy |
| Geoapify | 3,000 requests/day | Per API key |

## Appendix B: Estimated Costs

| Service | Free Tier | Estimated Monthly Cost |
|---------|-----------|----------------------|
| Vercel | 100GB bandwidth | $0 (hobby) → $20 (pro) |
| Neon PostgreSQL | 3 projects | $0 (free) → $19 (pro) |
| Geoapify | 3k requests/day | $0 |
| Domain | N/A | $12/year |
| **Total** | | **~$0-30/month** |

## Appendix C: Glossary

- **Glassmorphism:** UI design trend with frosted glass effect
- **OAuth 2.0:** Authorization framework for secure API access
- **JAMstack:** JavaScript, APIs, and Markup architecture
- **Madhab:** Islamic school of jurisprudence
- **Adhan:** Islamic call to prayer
- **Hijri:** Islamic lunar calendar

---

**Document End**

*This requirements document is a living document and will be updated as the project evolves.*