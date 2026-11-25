import { DbPool } from './pool';

export async function runMigrations(pool: DbPool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('CUSTOMER', 'ADMIN')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS flights (
      id SERIAL PRIMARY KEY,
      flight_number VARCHAR(32) NOT NULL,
      origin VARCHAR(120) NOT NULL,
      destination VARCHAR(120) NOT NULL,
      departure_time TIMESTAMP NOT NULL,
      price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
      total_seats INTEGER NOT NULL CHECK (total_seats > 0 AND total_seats <= 600),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_flights_search
    ON flights (origin, destination, departure_time);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      booking_reference VARCHAR(32) NOT NULL UNIQUE,
      flight_id INTEGER NOT NULL REFERENCES flights(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seat_number VARCHAR(10) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TIMESTAMP
    );
  `);

  // Enforce at the database level that a seat on a flight can only have one CONFIRMED booking,
  // while still allowing the same seat to be booked again after a previous booking is CANCELLED.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_active_seat
    ON bookings (flight_id, seat_number)
    WHERE status = 'CONFIRMED';
  `);
}

