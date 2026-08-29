<div align="center">
  <img src="frontend/public/leadflow-logo-white-bg.svg" alt="LeadFlow logo" width="90" />
  <h1>LeadFlow</h1>
  <p>
    A full-stack, role-based CRM dashboard for managing leads, follow-ups, and sales pipeline visibility.
  </p>
</div>

## Overview

LeadFlow is a sales-focused lead management application designed for teams that want a cleaner, structured way to track leads and monitor conversion performance. The current build is an early MVP focused on the dashboard and core workflow: authentication, lead CRUD, status tracking, and pipeline insights.

This project is built to showcase a practical full-stack workflow using React on the frontend, Express and MongoDB on the backend, and JWT-based protection for secure access.

## Current Status

This project is in an active MVP stage and is not yet a complete production CRM.

What is working now:
- User registration and login
- JWT-authenticated protected routes
- Dashboard KPI cards for lead performance
- Lead creation, update, and delete operations
- Search and status filtering for leads
- Follow-up tracking via next follow-up dates
- Role-based access logic using system roles
- Responsive dashboard UI with Redux state management

What is still in progress:
- Advanced team assignment workflows
- Sales rep management and lead ownership flows
- Detailed lead profile pages and activity history
- Analytics dashboards and reporting views
- Automated follow-up reminders and notifications
- Production-level testing and deployment cleanup

## Features

### Implemented
- Secure authentication with JWT
- Protected frontend and API routes
- Role-based access using `admin`, `leader`, `member`, and `viewer`
- Dashboard summary for total, new, contacted, qualified, converted, and lost leads
- Conversion rate tracking
- Search by lead name, email, or phone number
- Filter leads by status
- Create, edit, and delete lead records
- Lead source, notes, and next follow-up tracking
- MongoDB-backed persistence with Mongoose
- Responsive React interface

### Planned
- Team dashboards and assignment workflows
- Sales rep analytics and leaderboard views
- Lead detail pages with history and notes
- Reminder automation and scheduling
- CSV export and reporting
- Admin controls and user management
- Email/SMS integrations

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, Redux Toolkit, React Router, Axios, Tailwind CSS, Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| API | RESTful API |

## Application Flow

```text
Register / Login
      ↓
JWT authentication
      ↓
Protected dashboard
      ↓
Create, read, update, and delete leads
      ↓
Track follow-ups and pipeline status
      ↓
Monitor performance through dashboard statistics
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
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   └── leadController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── models/
│   │   │   ├── Lead.js
│   │   │   ├── Rank.js
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── dashboardRoutes.js
│   │   │   └── leadRoutes.js
│   │   └── utils/
│   │       └── generateToken.js
│   ├── package.json
│   └── .env.example
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
│   │   │   └── crm/
│   │   │       └── crmSlice.js
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── .env.example
├── .gitignore
└── README.md
```

## API Endpoints

### Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Public | Create a new account |
| POST | `/api/auth/login` | Public | Log in and receive a JWT |
| GET | `/api/auth/me` | Authenticated | Retrieve the current authenticated user |

### Leads

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/leads` | Authenticated | Create a lead |
| GET | `/api/leads` | Authenticated | List leads permitted to the user |
| PATCH | `/api/leads/:id` | Authorized owner/Admin/Leader | Update a lead |
| DELETE | `/api/leads/:id` | Authorized owner/Admin/Leader | Delete a lead |

Supported lead queries:

```text
GET /api/leads?status=qualified
GET /api/leads?search=Amit
GET /api/leads?status=new&search=Sharma
```

### Dashboard

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dashboard/stats` | Authenticated | Get dashboard KPI counts |

### Health Check

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Check whether the API is running |

## Getting Started

### Prerequisites

- Node.js 20.19+
- npm
- MongoDB instance or MongoDB Atlas

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd LeadFlow
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure environment variables

Create a `.env` file inside the `backend` folder:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/leadflow
JWT_SECRET=replace_with_a_long_random_secret
CLIENT_URL=http://localhost:5173
```

### 5. Run the app

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

Then open:

```text
http://localhost:5173
```

## Available Scripts

### Backend

```bash
npm run dev   # start the backend in development mode
npm start     # start the backend with Node
```

### Frontend

```bash
npm run dev      # run Vite dev server
npm run build    # create production bundle
npm run preview  # preview the production build
npm run lint     # run ESLint checks
```

## Authorization Model

| Role | Current behavior |
| --- | --- |
| Admin | Can access and manage all leads |
| Leader | Can access and manage all leads |
| Member | Typically manages leads assigned to their account |
| Viewer | Can access leads assigned to their account |

New users default to the `member` role. Role assignment is managed by the backend and not exposed as a public registration option.

## Security

- Passwords are hashed before saving to the database
- Protected endpoints require a valid JWT token
- User status is checked for each authenticated request
- Lead update and delete requests are restricted by ownership and role rules
- Sensitive values such as JWT secret and MongoDB URI are stored in environment variables
- Frontend origin can be restricted with `CLIENT_URL`

## Future Improvements

- Lead assignment between team members
- Leader and admin dashboards
- Lead detail pages and notes history
- Reminder automation and activity tracking
- Pagination and reporting
- Automated tests and CI/CD
- Email and SMS integrations

These improvements are planned for the next stage and are not part of the current MVP.

## Project Status

The core MVP is functional. Authentication, protected routes, lead management, filtering, and dashboard analytics are implemented, making the project a strong foundation for a more complete CRM platform.

## Author

Pankaj Prajapati

Built as a full-stack portfolio project to demonstrate lead management workflow design, API development, database modeling, and dashboard UI implementation.

---

## Developer Notes

This project is intentionally in an early but meaningful stage: the dashboard and core workflow are already in place, and the architecture supports future expansion without a rebuild. It is suitable as a portfolio project, internal prototype, or starting point for a broader CRM platform.

---

## License

This project is currently under active development and is intended for learning and portfolio use. License details may be added as the project matures.

---

## Summary

LeadFlow is a practical full-stack CRM dashboard that reflects a real-world sales workflow. It is not production-complete yet, but it already demonstrates important skills in authentication, API design, database modeling, state management, and modern frontend development.

It is a strong foundation for a resume portfolio because it shows:
- full-stack product thinking
- frontend + backend integration
- database-driven application logic
- real user workflow design
- a dashboard-first business tool prototype

