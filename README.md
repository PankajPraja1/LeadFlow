<div align="center">
  <img src="frontend/public/leadflow-logo-white-bg.svg" alt="LeadFlow logo" width="90" />
  <h1>LeadFlow</h1>
  <p>A deployed, full-stack CRM for secure lead management, follow-ups, interaction notes, pipeline analytics, and activity tracking.</p>
</div>

## Overview

LeadFlow is a full-stack, role-based CRM application designed to help sales and marketing teams organize leads, schedule follow-ups, monitor pipeline stages, and maintain a traceable history of lead interactions.

The application combines a responsive React interface with an Express REST API, MongoDB Atlas persistence, JWT authentication, record-level authorization, Redux state management, and automated activity tracking. Both the frontend and backend are deployed on Vercel.

## Live Demo

- Application: [Open LeadFlow](https://leadflow-hazel-xi.vercel.app)
- API health: [Check LeadFlow API](https://leadflow-api-liard.vercel.app/api/health)

## Project Status

**Current release: v1.2.0**

LeadFlow is a functional, deployed CRM portfolio project under active development. Authentication, lead management, pipeline analytics, follow-up scheduling, lead-detail pages, interaction notes, and activity history are implemented and working.

## Features

### Authentication and authorization

- User registration, login, logout, and persistent authenticated sessions
- Password hashing with bcryptjs
- JWT-protected frontend and API routes
- Role-based access using `admin`, `leader`, `member`, and `viewer`
- Record-level authorization for lead and note operations
- Active-user verification on authenticated requests
- Dedicated profile and account-security page
- Secure name and email updates
- Current-password verification for email changes
- Password change with confirmation and bcrypt rehashing
- Versioned JWT sessions that invalidate older tokens after password changes

### Lead management

- Create, retrieve, update, and delete leads
- Five-stage pipeline: new, contacted, qualified, converted, and lost
- Search by lead name, email, or phone number
- Filter leads by pipeline status
- Track lead source, contact details, background notes, and next follow-up date
- Dedicated lead-detail page with complete lead information
- Ownership-aware access for assigned leads

### Notes and activity history

- Add multiple dated interaction notes to a lead
- Edit and delete notes with author and role-based permissions
- Display note author, creation time, and edited status
- Automatically record lead creation, updates, status changes, and follow-up changes
- Automatically record note creation, editing, and deletion
- Display a chronological activity timeline with user attribution and activity-specific icons
- Remove related notes and activities when a lead is deleted

### Dashboard and user experience

- KPI cards for total, new, contacted, qualified, converted, and lost leads
- Conversion-rate analytics
- Upcoming and overdue follow-up counts
- Responsive React and Tailwind CSS interface
- Redux Toolkit state management for dashboard and lead-detail workflows
- Loading, empty, validation, and controlled error states
- Refresh-safe React Router routes on Vercel

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Redux Toolkit, React Router, Axios, Tailwind CSS, Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas, Mongoose |
| Authentication | JSON Web Token, bcryptjs |
| API | RESTful API |
| Deployment | Vercel |

## Application Flow

```text
Register / Login
      ↓
JWT authentication and protected routes
      ↓
Role-aware dashboard and lead access
      ↓
Create, search, filter, update, and delete leads
      ↓
Open lead details and manage interaction notes
      ↓
Automatically record changes in the activity timeline
      ↓
Track follow-ups, pipeline stages, and conversion metrics
```

## Project Structure

```text
LeadFlow/
├── backend/
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   └── db.js
│   │   ├── controllers/
│   │   │   ├── activityController.js
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── leadController.js
│   │   │   └── leadNoteController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── models/
│   │   │   ├── Activity.js
│   │   │   ├── Lead.js
│   │   │   ├── LeadNote.js
│   │   │   ├── Rank.js
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   └── leadRoutes.js
│   │   ├── services/
│   │   │   └── activityService.js
│   │   └── utils/
│   │       ├── generateToken.js
│   │       └── leadAccess.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── public/
│   │   ├── leadflow-logo-white-bg.svg
│   │   ├── leadflow-logo.svg
│   │   └── leadflow-logo.png
│   ├── src/
│   │   ├── app/
│   │   │   └── store.js
│   │   ├── components/
│   │   │   ├── LeadModal.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   └── authSlice.js
│   │   │   ├── crm/
│   │   │   │   └── crmSlice.js
│   │   │   └── leads/
│   │   │       └── leadDetailsSlice.js
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LeadDetailsPage.jsx
│   │   │   ├── ProfilePage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## API Endpoints

### Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a new account |
| POST | `/api/auth/login` | Public | Log in and receive a JWT |
| GET | `/api/auth/me` | Authenticated | Retrieve the current user |
| PATCH | `/api/auth/profile` | Authenticated | Update the current user's name or email |
| PATCH | `/api/auth/password` | Authenticated | Change password and issue a versioned JWT |

### Leads

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/leads` | Authenticated | Create a lead |
| GET | `/api/leads` | Authenticated | List leads accessible to the user |
| GET | `/api/leads/:id` | Authorized | Retrieve one lead and its details |
| PATCH | `/api/leads/:id` | Authorized | Update a lead |
| DELETE | `/api/leads/:id` | Authorized | Delete a lead and related records |

Supported lead queries:

```text
GET /api/leads?status=qualified
GET /api/leads?search=Amit
GET /api/leads?status=new&search=Sharma
```

### Lead notes

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/leads/:id/notes` | Authorized | List a lead's interaction notes |
| POST | `/api/leads/:id/notes` | Authorized | Add an interaction note |
| PATCH | `/api/leads/:id/notes/:noteId` | Note author/Admin/Leader | Edit a note |
| DELETE | `/api/leads/:id/notes/:noteId` | Note author/Admin/Leader | Delete a note |

### Lead activities

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/leads/:id/activities` | Authorized | Retrieve the latest lead activities |

### Dashboard and health

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dashboard/stats` | Authenticated | Retrieve dashboard KPI counts |
| GET | `/api/health` | Public | Check whether the API is running |

## Getting Started

### Prerequisites

- Node.js 20.19+
- npm
- MongoDB instance or MongoDB Atlas cluster

### 1. Clone the repository

```bash
git clone https://github.com/PankajPraja1/LeadFlow.git
cd LeadFlow
```

### 2. Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Configure backend environment variables

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/leadflow
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

For MongoDB Atlas, replace `MONGODB_URI` with the Atlas connection string. Never commit the real `.env` file.

### 4. Configure frontend environment variables

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

### 5. Run the application

Start the backend:

```bash
cd backend
npm run dev
```

Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173`.

## Available Scripts

### Backend

```bash
npm run dev   # Start with Nodemon
npm start     # Start with Node.js
```

### Frontend

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production bundle
npm run preview   # Preview the production bundle
npm run lint      # Run ESLint
```

## Authorization Model

| Role | Current behaviour |
| --- | --- |
| Admin | Can access and manage all leads and notes |
| Leader | Can access and manage all leads and notes |
| Member | Can access assigned leads and manage notes they authored |
| Viewer | Can access leads assigned to their account |

New registrations receive the `member` role. System roles are assigned by the backend and cannot be selected through public registration.

## Security

- Passwords are hashed before storage
- Protected endpoints require a valid JWT
- Authenticated requests verify that the associated user still exists and is active
- Lead access is restricted through server-side role and ownership filters
- Note editing and deletion require authorship or elevated role access
- Invalid lead and note identifiers are validated before database operations
- MongoDB and JWT credentials remain in backend environment variables
- CORS restricts browser access to the configured frontend origin
- Database connections are reused in the serverless deployment environment
- Email changes require current-password verification
- Password changes increment the user's token version
- JWT token-version checks invalidate sessions created before a password change

## Version History

### v1.2.0

- Added a dedicated profile and account-security page
- Added secure name and email updates
- Added current-password verification for email changes
- Added authenticated password-change workflow
- Added versioned JWT invalidation for older sessions
- Improved authentication validation and Redux feedback states

### v1.1.0

- Added dedicated lead-detail pages
- Added multiple interaction notes with edit/delete permissions
- Added automatic lead and note activity tracking
- Added chronological activity timeline with user attribution
- Improved record-level authorization and invalid-ID handling
- Added related-record cleanup when deleting leads

### v1.0.0

- Released the deployed CRM MVP
- Added authentication, protected routes, lead CRUD, search, filters, follow-up dates, and dashboard analytics
- Connected MongoDB Atlas and deployed the frontend and backend on Vercel

## Roadmap

- Dedicated upcoming and overdue follow-ups workspace
- Reusable marketing-plan and outreach-sequence management
- Team member management and lead assignment
- Automated email reminders and in-app notifications
- AI-assisted lead summaries, prioritization, next actions, and outreach drafts
- Real-time dashboard updates
- Pagination, automated tests, API documentation, and CI/CD

## Author

**Pankaj Prajapati**

Built as a full-stack portfolio project to demonstrate secure API development, database modelling, record-level authorization, state management, deployment, and business-workflow design.
