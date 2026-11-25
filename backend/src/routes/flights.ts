import { Router } from 'express';
import { DbPool } from '../db/pool';
import { authenticate, requireRole } from '../middleware/auth';
import { buildSeatMap, generateSeatCodes } from '../utils/seats';
import { normalizeDepartureInput, toWallClockIso } from '../utils/time';

interface FlightWithCountsRow {
  id: number;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: Date | string;
  price: string | number;
  total_seats: number;
  booked_seats: string | number;
}

function serializeFlight(row: FlightWithCountsRow) {
  const totalSeats = Number(row.total_seats);
  const bookedSeats = Number(row.booked_seats ?? 0);
  return {
    id: row.id,
    flightNumber: row.flight_number,
    origin: row.origin,
    destination: row.destination,
    departureTime: toWallClockIso(row.departure_time),
    price: Number(row.price),
    totalSeats,
    bookedSeats,
    availableSeats: Math.max(0, totalSeats - bookedSeats),
  };
}

export function createFlightsRouter(pool: DbPool): Router {
  const router = Router();

  // Search/list flights with booked & available seat counts
  router.get('/', async (req, res) => {
    try {
      const from =
        typeof req.query.from === 'string' ? req.query.from.trim() : '';
      const to = typeof req.query.to === 'string' ? req.query.to.trim() : '';
      const date =
        typeof req.query.date === 'string' ? req.query.date.trim() : '';

      const conditions: string[] = [];
      const params: unknown[] = [];

      if (from) {
        params.push(`%${from}%`);
        conditions.push(`LOWER(f.origin) LIKE LOWER($${params.length})`);
      }

      if (to) {
        params.push(`%${to}%`);
        conditions.push(`LOWER(f.destination) LIKE LOWER($${params.length})`);
      }

      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          res
            .status(400)
            .json({ error: 'Date must be in YYYY-MM-DD format' });
          return;
        }
        params.push(`${date} 00:00:00`);
        const startIdx = params.length;
        params.push(`${date} 23:59:59`);
        const endIdx = params.length;
        conditions.push(
          `f.departure_time >= $${startIdx} AND f.departure_time <= $${endIdx}`
        );
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query<FlightWithCountsRow>(
        `SELECT
           f.id,
           f.flight_number,
           f.origin,
           f.destination,
           f.departure_time,
           f.price,
           f.total_seats,
           COUNT(b.id) AS booked_seats
         FROM flights f
         LEFT JOIN bookings b
           ON b.flight_id = f.id AND b.status = 'CONFIRMED'
         ${whereClause}
         GROUP BY f.id, f.flight_number, f.origin, f.destination, f.departure_time, f.price, f.total_seats
         ORDER BY f.departure_time ASC, f.id ASC`,
        params
      );

      res.json({ flights: result.rows.map(serializeFlight) });
    } catch (err) {
      console.error('List flights error:', err);
      res.status(500).json({ error: 'Failed to load flights' });
    }
  });

  // Get single flight with full interactive seat map
  router.get('/:id', async (req, res) => {
    try {
      const flightId = Number(req.params.id);
      if (!Number.isInteger(flightId) || flightId <= 0) {
        res.status(400).json({ error: 'Invalid flight ID' });
        return;
      }

      const flightResult = await pool.query<FlightWithCountsRow>(
        `SELECT
           f.id,
           f.flight_number,
           f.origin,
           f.destination,
           f.departure_time,
           f.price,
           f.total_seats,
           COUNT(b.id) AS booked_seats
         FROM flights f
         LEFT JOIN bookings b
           ON b.flight_id = f.id AND b.status = 'CONFIRMED'
         WHERE f.id = $1
         GROUP BY f.id, f.flight_number, f.origin, f.destination, f.departure_time, f.price, f.total_seats`,
        [flightId]
      );

      const flightRow = flightResult.rows[0];
      if (!flightRow) {
        res.status(404).json({ error: 'Flight not found' });
        return;
      }

      const bookedSeatsResult = await pool.query<{ seat_number: string }>(
        `SELECT seat_number
         FROM bookings
         WHERE flight_id = $1 AND status = 'CONFIRMED'`,
        [flightId]
      );

      const bookedSeatNumbers = bookedSeatsResult.rows.map(
        (r) => r.seat_number
      );
      const seats = buildSeatMap(Number(flightRow.total_seats), bookedSeatNumbers);

      res.json({
        flight: serializeFlight(flightRow),
        seats,
      });
    } catch (err) {
      console.error('Get flight error:', err);
      res.status(500).json({ error: 'Failed to load flight details' });
    }
  });

  // Admin: Create flight
  router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
      const flightNumber =
        typeof req.body?.flightNumber === 'string'
          ? req.body.flightNumber.trim().toUpperCase()
          : '';
      const origin =
        typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
      const destination =
        typeof req.body?.destination === 'string'
          ? req.body.destination.trim()
          : '';
      const departureTime = normalizeDepartureInput(req.body?.departureTime);
      const price = Number(req.body?.price);
      const totalSeats = Number(req.body?.totalSeats);

      if (!flightNumber || flightNumber.length < 2) {
        res.status(400).json({ error: 'Flight number is required' });
        return;
      }
      if (!origin || !destination) {
        res
          .status(400)
          .json({ error: 'Departure and destination cities are required' });
        return;
      }
      if (origin.toLowerCase() === destination.toLowerCase()) {
        res
          .status(400)
          .json({ error: 'Departure and destination cities must differ' });
        return;
      }
      if (!departureTime) {
        res.status(400).json({ error: 'Valid departure date and time required' });
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: 'Price must be a non-negative number' });
        return;
      }
      if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > 600) {
        res
          .status(400)
          .json({ error: 'Total seats must be an integer between 1 and 600' });
        return;
      }

      const result = await pool.query<FlightWithCountsRow>(
        `INSERT INTO flights (flight_number, origin, destination, departure_time, price, total_seats)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, flight_number, origin, destination, departure_time, price, total_seats, 0 AS booked_seats`,
        [flightNumber, origin, destination, departureTime, price, totalSeats]
      );

      res.status(201).json({ flight: serializeFlight(result.rows[0]) });
    } catch (err) {
      console.error('Create flight error:', err);
      res.status(500).json({ error: 'Failed to create flight' });
    }
  });

  // Admin: Edit flight
  router.put('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
    try {
      const flightId = Number(req.params.id);
      if (!Number.isInteger(flightId) || flightId <= 0) {
        res.status(400).json({ error: 'Invalid flight ID' });
        return;
      }

      const existing = await pool.query<{ id: number; total_seats: number }>(
        'SELECT id, total_seats FROM flights WHERE id = $1',
        [flightId]
      );
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Flight not found' });
        return;
      }

      const flightNumber =
        typeof req.body?.flightNumber === 'string'
          ? req.body.flightNumber.trim().toUpperCase()
          : '';
      const origin =
        typeof req.body?.origin === 'string' ? req.body.origin.trim() : '';
      const destination =
        typeof req.body?.destination === 'string'
          ? req.body.destination.trim()
          : '';
      const departureTime = normalizeDepartureInput(req.body?.departureTime);
      const price = Number(req.body?.price);
      const totalSeats = Number(req.body?.totalSeats);

      if (!flightNumber || !origin || !destination || !departureTime) {
        res.status(400).json({ error: 'All flight fields are required' });
        return;
      }
      if (origin.toLowerCase() === destination.toLowerCase()) {
        res
          .status(400)
          .json({ error: 'Departure and destination cities must differ' });
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ error: 'Price must be a non-negative number' });
        return;
      }
      if (!Number.isInteger(totalSeats) || totalSeats < 1 || totalSeats > 600) {
        res
          .status(400)
          .json({ error: 'Total seats must be an integer between 1 and 600' });
        return;
      }

      // Ensure no active confirmed seat falls outside the updated seat count
      const activeBookings = await pool.query<{ seat_number: string }>(
        `SELECT seat_number FROM bookings WHERE flight_id = $1 AND status = 'CONFIRMED'`,
        [flightId]
      );
      const allowedSeats = new Set(generateSeatCodes(totalSeats));
      const conflictingSeat = activeBookings.rows.find(
        (b) => !allowedSeats.has(b.seat_number.toUpperCase())
      );
      if (conflictingSeat) {
        res.status(400).json({
          error: `Cannot reduce total seats to ${totalSeats} because seat ${conflictingSeat.seat_number} is already booked`,
        });
        return;
      }

      await pool.query(
        `UPDATE flights
         SET flight_number = $1,
             origin = $2,
             destination = $3,
             departure_time = $4,
             price = $5,
             total_seats = $6
         WHERE id = $7`,
        [
          flightNumber,
          origin,
          destination,
          departureTime,
          price,
          totalSeats,
          flightId,
        ]
      );

      const updated = await pool.query<FlightWithCountsRow>(
        `SELECT
           f.id,
           f.flight_number,
           f.origin,
           f.destination,
           f.departure_time,
           f.price,
           f.total_seats,
           COUNT(b.id) AS booked_seats
         FROM flights f
         LEFT JOIN bookings b
           ON b.flight_id = f.id AND b.status = 'CONFIRMED'
         WHERE f.id = $1
         GROUP BY f.id, f.flight_number, f.origin, f.destination, f.departure_time, f.price, f.total_seats`,
        [flightId]
      );

      res.json({ flight: serializeFlight(updated.rows[0]) });
    } catch (err) {
      console.error('Update flight error:', err);
      res.status(500).json({ error: 'Failed to update flight' });
    }
  });

  // Admin: Delete flight
  router.delete(
    '/:id',
    authenticate,
    requireRole('ADMIN'),
    async (req, res) => {
      try {
        const flightId = Number(req.params.id);
        if (!Number.isInteger(flightId) || flightId <= 0) {
          res.status(400).json({ error: 'Invalid flight ID' });
          return;
        }

        const result = await pool.query<{ id: number }>(
          'DELETE FROM flights WHERE id = $1 RETURNING id',
          [flightId]
        );
        if (result.rows.length === 0) {
          res.status(404).json({ error: 'Flight not found' });
          return;
        }

        res.json({ deleted: true, id: flightId });
      } catch (err) {
        console.error('Delete flight error:', err);
        res.status(500).json({ error: 'Failed to delete flight' });
      }
    }
  );

  return router;
}

