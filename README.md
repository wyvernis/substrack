# substrack

subscription tracking web application built with node.js, express, and mongodb. track recurring payments, set budgets, view analytics, and manage shared plans from a single dashboard.

live locally at `http://localhost:5001` after setup.

---

## features

- user authentication (register, login, password reset via email)
- subscription management with categories, billing cycles, notes, tags, and invoice links
- dashboard overview with monthly/yearly spend, active vs cancelled counts, and renewal timeline
- search and filter subscriptions by name, status, and category
- budget tracking with progress bar and over-budget alerts
- spending analytics (category pie chart, top expenses, monthly trends)
- smart insights (unused subscriptions, duplicates, cancel suggestions, cheaper alternatives)
- shared plans with collaborator invites and cost splitting
- csv import for bulk subscription upload
- profile and settings (currency default inr, dark mode, reminder preferences)
- email and browser reminders for upcoming renewals, trial endings, and budget limits

---

## tech stack

| layer | tools |
|-------|-------|
| backend | node.js, express, mongoose |
| database | mongodb |
| auth | jwt, bcryptjs |
| email | nodemailer |
| frontend | vanilla html, css, javascript |
| charts | chart.js |

---

## prerequisites

- node.js 18 or later
- mongodb 6+ running locally or a mongodb atlas connection string
- smtp credentials (optional, for password reset and renewal emails)

---

## installation

```bash
git clone https://github.com/wyvernis/finalproject.git
cd finalproject
npm install
```

copy the environment template and fill in your values:

```bash
cp .env.example .env
```

start mongodb if running locally, then start the server:

```bash
npm start
```

for development with auto-reload:

```bash
npm run dev
```

open `http://localhost:5001` in your browser.

---

## environment variables

| variable | description |
|----------|-------------|
| `PORT` | server port (default `5001`) |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | mongodb connection string |
| `JWT_SECRET` | secret key for signing auth tokens |
| `CLIENT_URL` | base url used in password reset links |
| `EMAIL_HOST` | smtp host |
| `EMAIL_PORT` | smtp port |
| `EMAIL_USER` | smtp username |
| `EMAIL_PASS` | smtp password or app password |
| `EMAIL_FROM` | sender address for outgoing mail |
| `CORS_ORIGIN` | allowed frontend origin |

never commit `.env` to version control. use `.env.example` as a reference only.

---

## project structure

```
finalproject/
├── config/           database connection
├── middleware/       jwt auth middleware
├── models/           mongoose schemas (user, subscription, budget, shared, etc.)
├── routes/           api route handlers
├── utils/            email, currency, insights, reminders, spending logs
├── public/           static frontend (landing, auth, dashboard, settings)
│   ├── css/          design system and theme
│   └── js/           app, dashboard, settings, navigation logic
├── server.js         express entry point
├── .env.example      environment template
└── package.json
```

---

## api overview

base url: `http://localhost:5001/api`

### auth

| method | endpoint | description |
|--------|----------|-------------|
| post | `/auth/register` | create account |
| post | `/auth/login` | sign in, returns jwt |
| post | `/auth/logout` | clear session cookie |
| post | `/auth/forgot-password` | send reset email |
| post | `/auth/reset-password/:token` | reset password |
| get | `/auth/profile` | get user profile |
| put | `/auth/profile` | update name or email |
| get | `/auth/settings` | get user preferences |
| put | `/auth/settings` | update currency, theme, reminders |
| post | `/auth/change-password` | change password |

### subscriptions

| method | endpoint | description |
|--------|----------|-------------|
| get | `/subscriptions` | list subscriptions (supports `status`, `category`, `search` query params) |
| post | `/subscriptions` | add subscription |
| put | `/subscriptions/:id` | update subscription |
| delete | `/subscriptions/:id` | delete subscription |
| post | `/subscriptions/:id/mark-used` | record usage for insights |
| post | `/subscriptions/import` | import from csv |
| get | `/subscriptions/upcoming` | upcoming renewals |
| get | `/subscriptions/stats` | spending statistics |

### budget

| method | endpoint | description |
|--------|----------|-------------|
| get | `/budget` | get budget settings |
| post | `/budget` | set monthly budget |
| get | `/budget/status` | current spend vs budget |

### analytics

| method | endpoint | description |
|--------|----------|-------------|
| get | `/analytics/overview` | dashboard summary |
| get | `/analytics/trends` | monthly spending trend |
| get | `/analytics/insights` | smart suggestions |

### shared

| method | endpoint | description |
|--------|----------|-------------|
| get | `/shared` | list shared plans |
| post | `/shared` | invite collaborator |
| delete | `/shared/:id` | remove shared plan |

authenticated requests require the `x-auth-token` header or a `token` cookie.

---

## csv import format

header row required. supported columns:

```
name,amount,category,billing_cycle,next_billing_date,notes,tags
```

example:

```
name,amount,category,billing_cycle,next_billing_date
netflix,649,streaming,monthly,2026-07-01
spotify,119,music,monthly,2026-07-15
```

paste csv content in the dashboard import tab or post to `/api/subscriptions/import`.

---

## health check

```
GET /health
```

returns server and mongodb connection status.

---

## team

| name | email |
|------|-------|
| gayatri | vgayatri23comp@student.mes.ac.in |
| snehal | csnehal23comp@student.mes.ac.in |
| aditi | gaditi23comp@student.mes.ac.in |

---

## license

academic project. all rights reserved.
