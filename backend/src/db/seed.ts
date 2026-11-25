import bcrypt from 'bcryptjs';
import { DbPool } from './pool';

export const TEST_ACCOUNTS = {
  admin: {
    name: 'Admin User',
    email: 'admin@skybooker.com',
    password: 'AdminPassword123!',
    role: 'ADMIN' as const,
  },
  customer: {
    name: 'Amaya Perera',
    email: 'customer@skybooker.com',
    password: 'CustomerPassword123!',
    role: 'CUSTOMER' as const,
  },
};

export async function seedDatabase(pool: DbPool): Promise<void> {
  // Seed Admin & Customer accounts if they don't exist
  for (const account of [TEST_ACCOUNTS.admin, TEST_ACCOUNTS.customer]) {
    const existing = await pool.query<{ id: number }>(
      'SELECT id FROM users WHERE email = $1',
      [account.email]
    );
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(account.password, 10);
      await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)`,
        [account.name, account.email, hash, account.role]
      );
    }
  }

  // Seed flights only when the flights table is empty so admin edits/deletes persist
  const flightCount = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM flights'
  );
  if (Number(flightCount.rows[0]?.count ?? 0) === 0) {
    const sampleFlights = [
      {
        flightNumber: 'UL225',
        origin: 'Colombo',
        destination: 'Dubai',
        departureTime: '2026-12-25 10:30:00',
        price: 85000,
        totalSeats: 30,
      },
      {
        flightNumber: 'UL302',
        origin: 'Colombo',
        destination: 'Singapore',
        departureTime: '2026-12-25 14:15:00',
        price: 72500,
        totalSeats: 48,
      },
      {
        flightNumber: 'UL504',
        origin: 'Colombo',
        destination: 'London',
        departureTime: '2026-12-26 09:00:00',
        price: 215000,
        totalSeats: 78,
      },
      {
        flightNumber: 'EK651',
        origin: 'Colombo',
        destination: 'Dubai',
        departureTime: '2026-12-26 21:45:00',
        price: 92000,
        totalSeats: 60,
      },
      {
        flightNumber: 'UL101',
        origin: 'Colombo',
        destination: 'Male',
        departureTime: '2026-12-27 07:50:00',
        price: 45000,
        totalSeats: 24,
      },
      {
        flightNumber: 'QR665',
        origin: 'Dubai',
        destination: 'Doha',
        departureTime: '2026-12-28 16:20:00',
        price: 54000,
        totalSeats: 36,
      },
    ];

    for (const flight of sampleFlights) {
      await pool.query(
        `INSERT INTO flights (flight_number, origin, destination, departure_time, price, total_seats)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          flight.flightNumber,
          flight.origin,
          flight.destination,
          flight.departureTime,
          flight.price,
          flight.totalSeats,
        ]
      );
    }
  }
}

