# Prayer Times Calendar 🕌

A modern Next.js web application that automatically syncs Islamic prayer times to your Google Calendar with a beautiful glassmorphism UI.

![Next.js](https://img.shields.io/badge/Next.js-14+-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0+-38bdf8)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **🔐 Google OAuth Authentication** - Secure sign-in with Google account
- **📍 Location-Based Prayer Times** - Accurate prayer times based on your city
- **📅 Google Calendar Integration** - Automatic sync to your preferred calendar
- **🔔 Multiple Reminders** - Set multiple notification times for each prayer
- **🎨 Beautiful Glassmorphism UI** - Modern Islamic-themed design
- **🌙 Auto-Delete Past Events** - Keep your calendar clean automatically
- **📱 Mobile Responsive** - Works perfectly on all devices
- **⚡ Fast & Secure** - Serverless architecture with minimal data storage

## 🚀 Tech Stack

### Frontend
- **Next.js 14+** (App Router)
- **TypeScript** for type safety
- **Tailwind CSS** with custom glassmorphism
- **React Query** for data fetching
- **Framer Motion** for animations
- **Zod** for validation

### Backend
- **NextAuth.js** for authentication
- **PostgreSQL** with Prisma ORM
- **Vercel Serverless Functions**
- **Google Calendar API**

### External APIs
- **Aladhan API** - Prayer time calculations
- **Geoapify API** - City search and geocoding
- **Google Calendar API** - Calendar management

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** installed
2. **PostgreSQL database** (Neon or Supabase recommended)
3. **Google Cloud Console account** for OAuth setup
4. **Geoapify API key** (free tier available)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/prayer-times-calendar.git
cd prayer-times-calendar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Geoapify
GEOAPIFY_API_KEY="your-api-key"
```

### 4. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (development)
     - `https://your-domain.com/api/auth/callback/google` (production)
5. Copy Client ID and Client Secret to `.env.local`

### 5. Set up database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# (Optional) Open Prisma Studio to view database
npx prisma studio
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## 🏗️ Project Structure

```
prayer-times-calendar/
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Protected pages
│   ├── api/               # API routes
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── ui/                # Reusable UI components
│   ├── auth/              # Auth-related components
│   ├── dashboard/         # Dashboard components
│   └── setup/             # Setup wizard components
├── lib/                   # Utilities and helpers
│   ├── types/             # TypeScript types
│   └── validations/       # Zod schemas
├── hooks/                 # Custom React hooks
├── prisma/                # Database schema
└── public/                # Static assets
```

## 🔑 Key Features Implementation

### Prayer Time Calculation Methods

The app supports 5 different calculation methods:

1. **ISNA** - Islamic Society of North America
2. **MWL** - Muslim World League
3. **Umm Al-Qura** - Saudi Arabia
4. **Egyptian** - Egyptian General Authority
5. **Karachi** - University of Islamic Sciences

### Event Customization

Users can customize:
- **Event Title Template**: Use `{prayer}` placeholder (e.g., "🕌 {prayer}")
- **Multiple Reminders**: Set multiple notification times
- **Auto-Delete Options**:
  - 30 minutes after prayer
  - End of day
  - End of week
  - End of month

### Security Features

- OAuth 2.0 with PKCE flow
- API keys never exposed to frontend
- Minimal data storage (only user settings)
- httpOnly cookies for secure sessions

## 📝 API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | - | NextAuth.js endpoints |
| `/api/prayers/times` | GET | Fetch prayer times |
| `/api/cities/search` | GET | Search cities |
| `/api/calendar/sync` | POST | Sync to Google Calendar |
| `/api/calendar/list` | GET | List user's calendars |
| `/api/settings` | GET/PUT/DELETE | Manage settings |
| `/api/logs` | GET | Fetch sync history |

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy!

### Setting up Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/calendar/auto-sync",
      "schedule": "0 1 * * *"
    }
  ]
}
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run linter
npm run lint

# Type checking
npm run type-check
```

## 📈 Performance

- **Page Load**: < 2 seconds
- **API Response**: < 1 second
- **Calendar Sync**: < 5 seconds
- **Lighthouse Score**: 90+ across all metrics

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Aladhan API](https://aladhan.com) for prayer time calculations
- [Geoapify](https://www.geoapify.com) for geocoding services
- [Next.js](https://nextjs.org) for the amazing framework
- [Vercel](https://vercel.com) for hosting and deployment

## 💬 Support

For support, email support@prayertimescalendar.com or open an issue on GitHub.

## 🛣️ Roadmap

- [ ] Multi-language support (Arabic, Urdu, Turkish)
- [ ] Progressive Web App (PWA) for offline access
- [ ] Browser push notifications
- [ ] Qibla direction compass
- [ ] Mosque finder integration
- [ ] Prayer tracking statistics

---

Made with ❤️ for the Muslim community worldwide