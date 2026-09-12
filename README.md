<div align="center">

  <img src="frontend/public/leadflow-logo-white-bg.svg" alt="LeadFlow logo" width="90" />

  <h1>LeadFlow</h1>

  <p>A deployed, full-stack CRM for secure lead management, reusable marketing plans, follow-ups, pipeline analytics, and activity tracking.</p>

</div>

## Overview

LeadFlow is a full-stack, role-based CRM application for sales and marketing teams. It combines lead tracking, follow-up scheduling, pipeline analytics, interaction histories, and reusable marketing plans in one responsive workspace.

The application uses a React and Redux Toolkit frontend, an Express REST API, MongoDB Atlas, JWT and Google authentication, record-level authorization, secure password recovery, and automated activity tracking. Both the frontend and backend are deployed on Vercel.

## Live Demo

- Application: [Open LeadFlow](https://leadflow-hazel-xi.vercel.app)
- API health: [Check LeadFlow API](https://leadflow-api-liard.vercel.app/api/health)

## Project Status

**Version: v1.6.0 — email verification and authentication rate limits.**

The email-verification and authentication rate-limit changes are merged into `main` and deployed to both Vercel production projects. Local automated/browser checks and production verification have passed.

Authentication, account security, lead management, pipeline analytics, follow-up scheduling, lead-detail pages, interaction notes, activity history, and marketing-plan management are implemented and deployed.

The shared application layout, mobile navigation, and session recovery remain part of the deployed application. The roadmap below lists subsequent work.

### In progress: v1.7.0 — Follow-ups and personal tasks

The Task API, owner-only personal tasks, lead-linked follow-ups, transactional lead-date synchronization, migration tooling, and lead-form compatibility changes have passed local automated and browser checks. Production rollout and shared-database initialization are pending.

The dedicated Follow-ups workspace is still in development. v1.7.0 has not been released.

## Features

### Authentication and account security

- Email/password registration with email ownership verification before login
- Pending registration responses without an authentication token
- Public verification and resend pages, with an explicit action to consume email links
- Single-use verification links that expire after 24 hours
- Google authentication for new and existing users
- Google profile-picture support
- Password hashing with bcryptjs
- JWT-protected frontend and API routes
- Role-based access using `admin`, `leader`, and `member`
- Active-user checks and persistent authenticated sessions
- Session verification with retry after temporary API failures
- Recovery from invalid sessions without treating temporary network errors as logout
- Secure name and password updates
- Verified email changes: the current login address remains active until the new address is verified
- Persistent pending-email notices and cancellation from Profile
- Versioned JWT sessions that invalidate older tokens after password changes, resets, and successful email verification
- Email-based password recovery with single-use, SHA-256-hashed tokens
- Password-reset links that expire after 15 minutes
- Recovery that verifies ownership of the account email and clears pending email changes
- MongoDB-backed authentication rate limits shared across server instances

### Lead management

- Create, retrieve, update, and delete leads
- Five-stage pipeline: new, contacted, qualified, converted, and lost
- Search by name, email, or phone and filter by pipeline status
- Track lead source, contact details, notes, and next follow-up date
- Dedicated lead-detail pages
- Ownership-aware access for assigned leads

### Marketing-plan management

- Create reusable marketing and lead-conversion plans
- Store descriptions, target audiences, outreach pitches, and follow-up steps
- Draft, active, and archived plan states
- Search, status filtering, and paginated listings
- Admin access to manage every plan
- Leader access to create and manage owned plans
- Member access restricted to active plans
- Soft deletion through archival to preserve plan history

### Notes, activity, and analytics

- Add, edit, and delete dated interaction notes
- Author and role-based note permissions
- Automatic tracking of lead, status, follow-up, and note changes
- Chronological activity timeline with user attribution
- KPI cards for every pipeline stage
- Conversion-rate, upcoming follow-up, and overdue follow-up analytics

### User experience

- Responsive React and Tailwind CSS interface
- Shared protected layout for Dashboard and Leads, Marketing Plans, and Profile
- Responsive desktop navigation and a mobile navigation drawer
- Keyboard focus handling and focus restoration for the mobile drawer
- Consistent page headings and shared profile/logout controls
- Redux Toolkit state management
- Loading, empty, validation, success, and controlled error states
- Refresh-safe React Router routes on Vercel

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Redux Toolkit, React Router, Axios, Tailwind CSS, Lucide React |
| Backend | Node.js, Express.js, Nodemailer, ipaddr.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JSON Web Token, bcryptjs, Google Identity Services |
| API | RESTful API |
| Deployment | Vercel |

## Application Flow

Email/password registration creates a pending account and directs the user to email verification. Opening the email link displays a verification page; clicking **Verify email** consumes the token. The user then signs in to enter the protected shared layout. Registration itself does not issue a JWT.

Google sign-in verifies the ID token and applies the account-linking and email-ownership checks before issuing a session. A matching email alone does not activate an existing unverified password account.

Authenticated users can manage leads, open a lead's notes and activity history, browse marketing-plan templates, and update their profile. Leads hold the next follow-up date, while plans store reusable pitches and follow-up steps. Tracking each person's progress through a plan is planned work.

Changing an email address requires the current password. The new address stays pending until verified, and the user can cancel the request from Profile. A Google-only account must first set a password through password recovery to use this flow. Completing a reset or email verification requires a fresh sign-in.

## API Endpoints

### Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a pending account and send verification email; no JWT |
| POST | `/api/auth/login` | Public | Sign in to an active, verified account and receive a JWT |
| POST | `/api/auth/google` | Public | Authenticate with Google subject to ownership/linking checks |
| POST | `/api/auth/verify-email` | Public | Consume a verification token supplied in the request body |
| POST | `/api/auth/resend-verification` | Public | Request verification of the current account email |
| POST | `/api/auth/forgot-password` | Public | Request a password-reset email |
| PATCH | `/api/auth/reset-password/:token` | Public | Reset the password, verify the email, and invalidate prior sessions |
| GET | `/api/auth/me` | Authenticated | Retrieve the current user |
| PATCH | `/api/auth/profile` | Authenticated | Update the name or request a verified email change |
| PATCH | `/api/auth/password` | Authenticated | Change password and issue a new JWT |
| DELETE | `/api/auth/pending-email` | Authenticated | Cancel a pending email change and invalidate its link |

Authenticated routes require an active, email-verified account and a current JWT. Verification links use `/verify-email#token=...`; visiting the page does not consume a token through a GET request. To resend a pending email-change request, submit the pending address and current password through Profile after the cooldown.

### Leads

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/leads` | Authenticated | Create a lead |
| GET | `/api/leads` | Authenticated | List accessible leads |
| GET | `/api/leads/:id` | Authorized | Retrieve one lead |
| PATCH | `/api/leads/:id` | Authorized | Update a lead |
| DELETE | `/api/leads/:id` | Authorized | Delete a lead and related records |

Supported queries include `status` and `search`:

```text
GET /api/leads?status=qualified
GET /api/leads?search=Amit
GET /api/leads?status=new&search=Sharma
```

### Marketing plans

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/plans` | Admin/Leader | Create a plan |
| GET | `/api/plans` | Authenticated | Search, filter, and paginate accessible plans |
| GET | `/api/plans/:id` | Authenticated | Retrieve an accessible plan |
| PATCH | `/api/plans/:id` | Admin/Owner Leader | Update a plan |
| DELETE | `/api/plans/:id` | Admin/Owner Leader | Archive a plan |

```text
GET /api/plans?status=active
GET /api/plans?search=Social
GET /api/plans?status=draft&page=1&limit=10
```

### Notes, activities, dashboard, and health

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/leads/:id/notes` | Authorized | List interaction notes |
| POST | `/api/leads/:id/notes` | Authorized | Add an interaction note |
| PATCH | `/api/leads/:id/notes/:noteId` | Author/Admin/Leader | Edit a note |
| DELETE | `/api/leads/:id/notes/:noteId` | Author/Admin/Leader | Delete a note |
| GET | `/api/leads/:id/activities` | Authorized | Retrieve lead activity |
| GET | `/api/dashboard/stats` | Authenticated | Retrieve dashboard KPIs |
| GET | `/api/health` | Public | Check API health |

## Getting Started

### Prerequisites

- Node.js 20.19+
- npm
- MongoDB or MongoDB Atlas
- Google OAuth web client
- A Gmail sender with a Google App Password for verification and recovery email delivery

### Installation

```bash
git clone https://github.com/PankajPraja1/LeadFlow.git
cd LeadFlow

cd backend
npm install

cd ../frontend
npm install
```

### Backend environment

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/leadflow
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_web_client_id
EMAIL_USER=your_support_account@gmail.com
EMAIL_APP_PASSWORD=your_google_app_password
```

### Frontend environment

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id
```

The Google Client ID is public browser configuration. Database, JWT, and email credentials must remain backend-only and must never use the `VITE_` prefix. Never commit real `.env` files.

### Run locally

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

### Validation

From `backend`:

```bash
npm test
npm run test:rate-limit
```

`npm test` runs 28 email-verification and account-security tests with mocked database and external-service dependencies. `npm run test:rate-limit` uses the MongoDB connection configured in `backend/.env`; run it against a development database. It checks IP normalization, concurrent counting across limiter instances, persistence across instances, window rollover, and storage-failure handling. It deletes only its own uniquely scoped test counters and sends no emails.

From `frontend`:

```bash
npm run lint
npm run build
```

Local checks completed for this release include registration/verification, resend and token reuse, pending-email confirmation/cancellation, older-account verification, password reset across sessions, unverified-account recovery, unknown-email responses, and Google sign-in.

Production checks passed for registration and verification email delivery, production email links, rejection of reused verification tokens, older-account access and data preservation, password recovery across sessions, pending-email cancellation, Google sign-in, and protected-page refresh.

## Authentication Rate Limits

| Scope | Limit | Shared across |
| --- | --- | --- |
| Authentication writes | 60 requests per 15 minutes per IP/network | All POST, PATCH, and DELETE requests under `/api/auth` |
| Sign-in | 20 requests per 15 minutes per IP/network | Password and Google sign-in combined |
| Public email requests | 10 requests per hour per IP/network | Registration, resend verification, and forgot password combined |
| Account changes | 10 requests per 15 minutes per authenticated user | Profile, password, and pending-email cancellation |

Applicable limits accumulate, including successful requests. `GET /api/auth/me` is excluded. Verification and recovery email issuance also use a one-minute cooldown per account.

Counters are stored in the `auth_rate_limits` MongoDB collection, with atomic increments and a TTL index for eventual cleanup. Fixed-window boundaries determine resets; expired-document cleanup is not required to open a new window. Counter identifiers are HMAC-hashed with `JWT_SECRET`. IPv4 addresses are counted individually and IPv6 addresses are grouped by `/56` network.

Limited requests return HTTP `429` with a `Retry-After` header. If the limiter cannot use its required storage or determine a valid network identity, it returns HTTP `503`. These application limits provide basic abuse controls; people sharing a network also share its IP-based limits.

## Vercel Deployment

The existing setup uses two projects, with `frontend` and `backend` as their respective root directories.

| Project | Production configuration |
| --- | --- |
| Frontend | `VITE_API_URL=https://leadflow-api-liard.vercel.app/api` and the existing `VITE_GOOGLE_CLIENT_ID` |
| Backend | `CLIENT_URL=https://leadflow-hazel-xi.vercel.app`, plus `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `EMAIL_USER`, and `EMAIL_APP_PASSWORD` |

In the backend project's Environment Variables settings, enable **Enable access to System Environment Variables**. This exposes `VERCEL=1`, which the limiter uses to select Vercel's `x-vercel-forwarded-for` header. Local execution uses the socket address. Keep `VERCEL` out of the local development `.env`. See [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

The backend exports its Express app from `src/app.js`, a supported Vercel entry point; this release does not require a backend `vercel.json`. Keep the frontend's existing SPA rewrite so direct links to `/verify-email` and `/reset-password/:token` load React. See [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

Environment changes require new deployments. Deploy both projects from the same reviewed commit, then verify production registration, email links, sign-in, recovery, and protected-page refresh before tagging the release. Separate projects can finish deploying at different times, so confirm both are Ready before testing. See [Vercel environment variables](https://vercel.com/docs/environment-variables).

Existing password accounts without recorded email verification must verify their address before signing in; account data is preserved. Do not mark all existing accounts verified as a migration shortcut. Password-reset links issued before the new email-binding checks need to be requested again. Preview testing should use a development database and matching preview frontend/API URLs.

## Authorization Model

| Role | Current behaviour |
| --- | --- |
| Admin | Manages all leads, notes, and marketing plans |
| Leader | Has broad lead access under the current access helper; creates and manages owned plans |
| Member | Accesses assigned leads and active plans; manages authored notes |

New registrations receive the `member` role. System roles are assigned by the backend and cannot be selected through public registration.

Access based on actual team membership and sponsor relationships is planned. The current shared-lead permission does not represent an implemented upline/downline hierarchy. The `viewer` value exists in the User model; complete read-only endpoint coverage remains part of the access-control review.

## Security

- Protected endpoints require a valid, current JWT and verified email ownership
- Google ID tokens are verified against the configured OAuth Client ID
- Authenticated users must still exist and remain active
- Lead, plan, and note access is enforced server-side
- MongoDB IDs are validated before database operations
- MongoDB, JWT, and email credentials remain backend-only
- CORS restricts browser access to the configured frontend origin
- Password changes, resets, and email verification increment the token version and invalidate older sessions
- Verification tokens are random, hashed in storage, expire after 24 hours, and are consumed explicitly once
- Reset tokens are random, hashed in storage, bound to the current account email, expire after 15 minutes, and become unusable after reset
- Password recovery clears pending email changes and verifies ownership through the recovery email
- Resend and password-recovery requests use generic responses for unknown addresses
- MongoDB-backed rate limits apply to authentication writes, with additional sign-in, email-request, and account-change limits

## Version History

### v1.6.0

- Added email ownership verification and registration without an immediate session
- Added explicit verification, resend, and verification-aware login/Google flows
- Added pending email-change display, cancellation, and confirmation
- Preserved older accounts while requiring proof of email ownership
- Strengthened recovery, token consumption, and session invalidation
- Added MongoDB-backed authentication rate limits and database reconnection handling
- Added account-security tests and a MongoDB rate-limit integration check
- Completed local automated/browser checks and production validation on Vercel

### v1.5.0

- Added a shared protected application layout and responsive navigation
- Added mobile drawer keyboard focus handling and focus restoration
- Consolidated page headings, profile access, and logout controls
- Added session verification and retry after temporary API failures
- Improved invalid-session recovery and handling of stale authentication responses
- Updated form initialization to avoid effect-driven state resets

### v1.4.0

- Added reusable marketing-plan management
- Added pitches, target audiences, follow-up steps, and lifecycle statuses
- Added plan search, filtering, pagination, and soft archival
- Added Admin, Leader-owner, and Member permissions
- Added a Redux-powered plan management interface

### v1.3.0

- Added Google authentication and profile-picture support
- Added email-based forgot/reset-password workflow
- Added expiring, single-use, hashed reset tokens
- Added production password-reset email delivery

### v1.2.0

- Added profile and account-security pages
- Added secure name, email, and password updates
- Added current-password verification and versioned JWT invalidation

### v1.1.0

- Added lead-detail pages and interaction notes
- Added automatic activity tracking and a chronological timeline
- Improved record-level authorization and related-record cleanup

### v1.0.0-mvp

- Released the deployed CRM MVP
- Added authentication, protected routes, lead CRUD, search, filters, follow-up dates, and dashboard analytics
- Connected MongoDB Atlas and deployed the frontend and backend on Vercel

## Roadmap

- Dedicated Follow-ups workspace with completion history and personal tasks
- Automated email reminders and in-app notifications
- Program-specific ranks, memberships, sponsor trees, and scoped lead assignments
- Account archival with preserved activity attribution and ownership reassignment
- Conversion and onboarding plans with individual progress tracking
- Shared learning resources, scheduled classes, and member development plans
- AI-assisted lead summaries, prioritization, next actions, and outreach drafts
- Real-time updates and team/direct chat
- Advanced analytics, broader activity views, and application preferences
- Expanded automated integration coverage, API documentation, and CI/CD

## Author

**Pankaj Prajapati**

Built as a full-stack portfolio project to demonstrate secure API development, database modelling, record-level authorization, state management, deployment, and business-workflow design.
