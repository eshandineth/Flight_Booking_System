# SkyBooker — Flight Booking System

A full-stack flight reservation web application built with **React + TypeScript**, **Node.js + Express + TypeScript**, and **PostgreSQL**.

## Live App URL

- **Live Application:** `<UPDATE_WITH_DEPLOYED_URL>` (e.g. `https://skybooker-flight-booking.onrender.com`)

## Test Logins

| Role | Email | Password |
| :--- | :--- | :--- |
| **Customer** | `customer@skybooker.com` | `CustomerPassword123!` |
| **Admin** | `admin@skybooker.com` | `AdminPassword123!` |

Customers can also register new accounts directly from the **Sign In / Register** dialog.

---

## Features

- **Authentication & Roles**: JWT-based login and registration with `CUSTOMER` and `ADMIN` roles.
- **Flight Search**: Customers can search flights by departure city, destination city, and departure date.
- **Interactive Seat Map**: Visual 6-abreast (`A–C | aisle | D–F`) aircraft cabin map where booked seats are disabled and cannot be selected.
- **Concurrency-Safe Seat Booking**:
  - Generates a unique booking reference (e.g. `SKY-XXXXXX`).
  - Prevents double booking at both the **application transaction layer** (`SELECT ... FOR UPDATE` row lock) and the **PostgreSQL database layer** via a partial unique index:
    ```sql
    CREATE UNIQUE INDEX idx_bookings_unique_active_seat
    ON bookings (flight_id, seat_number)
    WHERE status = 'CONFIRMED';
    ```
- **My Bookings & Cancellation**: Customers can view their booking references and cancel confirmed bookings, immediately releasing the seat for other passengers.
- **Admin Dashboard**: View total flights, booked seat counts, and available seat counts per flight, plus add, edit, and delete flights.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Lucide Icons
- **Backend**: Node.js, Express, TypeScript, `pg` (node-postgres), `bcryptjs`, `jsonwebtoken`
- **Database**: PostgreSQL

---

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or Docker)

### 1. Start PostgreSQL

Using Docker Compose:
```bash
docker compose up -d
```

Or use any local/hosted PostgreSQL database named `flight_booking`.

### 2. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` if your PostgreSQL credentials differ from the default:
```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/flight_booking
JWT_SECRET=change-this-to-a-secure-random-secret-in-production
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 3. Install Dependencies

```bash
npm run install:all
```

### 4. Run in Development

Open two terminals:

**Terminal 1 (Backend API on port 4000):**
```bash
npm run dev:backend
```
On startup, the backend automatically runs SQL migrations and seeds the test accounts and sample flights (including `UL225`, Colombo → Dubai, 25 Dec 2026, 30 seats, Rs. 85,000).

**Terminal 2 (Frontend Vite dev server on port 5173):**
```bash
npm run dev:frontend
```

Open `http://localhost:5173` in your browser.

### 5. Run Automated Tests

```bash
npm test
```

### 6. Production Build (Unified Single Server)

```bash
npm run build
npm start
```
In production, Express serves both the `/api/*` endpoints and the compiled React frontend from `frontend/dist`.

---

## Free Cloud Deployment (Render Blueprint)

This repository includes [`render.yaml`](./render.yaml) for one-click free deployment on **Render**:

1. Push this repository to a public GitHub repo.
2. In [Render](https://render.com), click **New + → Blueprint** and connect your GitHub repository.
3. Render provisions both the **free PostgreSQL database** (`skybooker-db`) and the **Web Service** (`skybooker-flight-booking`), builds the frontend and backend, runs migrations + seed automatically on startup, and exposes a public HTTPS URL.
4. Update the **Live App URL** at the top of this `README.md`.

