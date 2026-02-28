# Planning Poker Online

A real-time collaborative Planning Poker application for agile teams, built with Next.js 14 and Supabase.

## Features

- **Real-time Voting**: Vote on story points simultaneously with your team
- **Beautiful Card Animations**: Smooth card flip animations using Framer Motion
- **Issue Management**: Add, manage, and track estimation issues
- **CSV Import**: Bulk import issues from CSV files
- **Live Collaboration**: See team members join/leave in real-time
- **Consensus Tracking**: Visual indicators when team reaches agreement
- **Coffee Break Cards**: Take a break when needed ☕
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Custom animations
- **Animations**: Framer Motion
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Authentication**: Supabase Auth (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Supabase account (free tier works)

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is ready, go to SQL Editor
3. Run the SQL migration file: `supabase/migrations/001_initial_schema.sql`
4. Copy your project URL and anon key from Settings → API

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How to Use

1. **Create a Game**: Enter a game name and click "Create Game"
2. **Share URL**: Copy the game URL and share with your team
3. **Add Issues**: Add issues manually or import from CSV
4. **Vote**: Each team member selects a card (Fibonacci sequence)
5. **Reveal**: Facilitator reveals all votes
6. **Discuss**: If votes differ, discuss and revote
7. **Next Issue**: Move to the next issue when consensus is reached

## Card Values

The deck uses the standard Planning Poker Fibonacci sequence:
`0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 100` plus a Coffee Break card (☕)

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── game/[id]/         # Game room page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── Card.tsx           # Card component with animations
│   ├── CardDeck.tsx       # Full deck of cards
│   ├── CSVImport.tsx      # CSV import modal
│   └── GameRoom.tsx       # Main game room component
├── hooks/                 # Custom React hooks
│   ├── useGame.ts         # Game state management
│   └── usePlayer.ts       # Player session management
├── lib/                   # Utilities
│   ├── database.types.ts  # Supabase database types
│   └── supabase.ts        # Supabase client
└── types/                 # TypeScript types
    └── index.ts           # Shared type definitions
```

## Database Schema

The app uses 4 main tables:

- **games**: Game rooms with settings
- **players**: Players in each game
- **issues**: Stories/tasks to estimate
- **votes**: Player votes per issue

See `supabase/migrations/001_initial_schema.sql` for full schema.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables
4. Deploy

### Environment Variables for Production

Make sure to set these in your hosting platform:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Future Enhancements

- [ ] User authentication for game history
- [ ] Premium features (unlimited issues, etc.)
- [ ] Jira/Linear integrations
- [ ] Advanced analytics and reporting
- [ ] Custom card decks
- [ ] Timer for voting rounds
- [ ] Export estimates to CSV/PDF
- [ ] Mobile app (React Native)

## License

MIT

## Credits

Inspired by [planningpokeronline.com](https://planningpokeronline.com/)

---

Built with ❤️ for agile teams
