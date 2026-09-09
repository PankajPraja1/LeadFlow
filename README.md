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

**Version: v1.5.0 — shared app layout and session recovery.**

Authentication, account security, lead management, pipeline analytics, follow-up scheduling, lead-detail pages, interaction notes, activity history, and marketing-plan management are implemented and deployed.

The shared layout and session-recovery changes are merged into `main`. Local checks and production navigation/authentication checks have passed. The roadmap below identifies planned features separately from implemented functionality.

## Features

### Authentication and account security

- Email/password registration and login
- Google authentication for new and existing users
- Google profile-picture support
- Password hashing with bcryptjs
- JWT-protected frontend and API routes
- Role-based access using `admin`, `leader`, and `member`
- Active-user checks and persistent authenticated sessions
- Session verification with retry after temporary API failures
- Recovery from invalid sessions without treating temporary network errors as logout
- Secure name, email, and password updates
- Versioned JWT sessions that invalidate older tokens after password changes
- Email-based password recovery with single-use, SHA-256-hashed tokens
- Password-reset links that expire after 15 minutes

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
| Backend | Node.js, Express.js, Nodemailer |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JSON Web Token, bcryptjs, Google Identity Services |
| API | RESTful API |
| Deployment | Vercel |

## Application Flow

After registration or sign-in, users enter the protected shared layout. They can manage leads, open a lead's notes and activity history, browse marketing-plan templates, and update their profile. Leads hold the next follow-up date, while plans store reusable pitches and follow-up steps. Tracking each person's progress through a plan is planned work.

## API Endpoints

### Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create an account |
| POST | `/api/auth/login` | Public | Log in and receive a JWT |
| POST | `/api/auth/google` | Public | Register or log in with Google |
| POST | `/api/auth/forgot-password` | Public | Request a password-reset email |
| PATCH | `/api/auth/reset-password/:token` | Public | Reset a password with a valid token |
| GET | `/api/auth/me` | Authenticated | Retrieve the current user |
| PATCH | `/api/auth/profile` | Authenticated | Update the current user's name or email |
| PATCH | `/api/auth/password` | Authenticated | Change password and issue a new JWT |

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
- SMTP-compatible email account for password-reset delivery

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
EMAIL_USER=your_support_email
EMAIL_APP_PASSWORD=your_email_app_password
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

## Authorization Model

| Role | Current behaviour |
| --- | --- |
| Admin | Manages all leads, notes, and marketing plans |
| Leader | Has broad lead access under the current access helper; creates and manages owned plans |
| Member | Accesses assigned leads and active plans; manages authored notes |

New registrations receive the `member` role. System roles are assigned by the backend and cannot be selected through public registration.

Access based on actual team membership and sponsor relationships is planned. The current shared-lead permission does not represent an implemented upline/downline hierarchy. The `viewer` value exists in the User model; complete read-only endpoint coverage remains part of the access-control review.

## Security

- Protected endpoints require a valid JWT
- Google ID tokens are verified against the configured OAuth Client ID
- Authenticated users must still exist and remain active
- Lead, plan, and note access is enforced server-side
- MongoDB IDs are validated before database operations
- MongoDB, JWT, and email credentials remain backend-only
- CORS restricts browser access to the configured frontend origin
- Password changes increment the token version and invalidate older sessions
- Reset tokens are random, hashed in storage, expire after 15 minutes, and become unusable after reset
- Successful password-recovery requests use a generic response message

## Version History

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

- Registration email ownership verification and verified email changes
- Dedicated Follow-ups workspace with completion history and personal tasks
- Automated email reminders and in-app notifications
- Program-specific ranks, memberships, sponsor trees, and scoped lead assignments
- Account archival with preserved activity attribution and ownership reassignment
- Conversion and onboarding plans with individual progress tracking
- Shared learning resources, scheduled classes, and member development plans
- AI-assisted lead summaries, prioritization, next actions, and outreach drafts
- Real-time updates and team/direct chat
- Advanced analytics, broader activity views, and application preferences
- Automated tests, API documentation, and CI/CD

## Author

**Pankaj Prajapati**

Built as a full-stack portfolio project to demonstrate secure API development, database modelling, record-level authorization, state management, deployment, and business-workflow design.
