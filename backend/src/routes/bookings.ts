import crypto from 'crypto';
import { Router } from 'express';
import { DbPool } from '../db/pool';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { isValidSeatForFlight } from '../utils/seats';
import { toWallClockIso } from '../utils/time';

interface BookingJoinRow {
  id: number;
  booking_reference: string;
  flight_id: number;
  user_id: number;
  seat_number: string;
  status: 'CONFIRMED' | 'CANCELLED';
  created_at: Date | string;
  cancelled_at: Date | string | null;
  flight_number: string;
  origin: string;
  destination: string;
  departure_time: Date | string;
  price: string | number;
}

function generateBookingReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `SKY-${code}`;
}

function serializeBooking(row: BookingJoinRow) {
  return {
    id: row.id,
    bookingReference: row.booking_reference,
    flightId: row.flight_id,
    userId: row.user_id,
    seatNumber: row.seat_number,
    status: row.status,
    createdAt: toWallClockIso(row.created_at),
    cancelledAt: row.cancelled_at ? toWallClockIso(row.cancelled_at) : null,
    flight: {
      id: row.flight_id,
      flightNumber: row.flight_number,
      origin: row.origin,
      destination: row.destination,
      departureTime: toWallClockIso(row.departure_time),
      price: Number(row.price),
    },
  };
}

export function createBookingsRouter(pool: DbPool): Router {
  const router = Router();

  // Book a seat atomically so two customers can never book the same seat
  router.post('/', authenticate, async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const flightId = Number(req.body?.flightId);
    const seatNumber =
      typeof req.body?.seatNumber === 'string'
        ? req.body.seatNumber.trim().toUpperCase()
        : '';

    if (!Number.isInteger(flightId) || flightId <= 0) {
      res.status(400).json({ error: 'Valid flightId is required' });
      return;
    }
    if (!seatNumber) {
      res.status(400).json({ error: 'seatNumber is required' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the flight row so concurrent booking attempts serialize safely
      const flightResult = await client.query<{
        id: number;
        flight_number: string;
        origin: string;
        destination: string;
        departure_time: Date | string;
        price: string | number;
        total_seats: number;
      }>(
        `SELECT id, flight_number, origin, destination, departure_time, price, total_seats
         FROM flights
         WHERE id = $1
         FOR UPDATE`,
        [flightId]
      );

      const flight = flightResult.rows[0];
      if (!flight) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Flight not found' });
        return;
      }

      if (!isValidSeatForFlight(seatNumber, Number(flight.total_seats))) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `Seat ${seatNumber} does not exist on flight ${flight.flight_number}`,
        });
        return;
      }

      const existing = await client.query<{ id: number }>(
        `SELECT id FROM bookings
         WHERE flight_id = $1 AND seat_number = $2 AND status = 'CONFIRMED'`,
        [flightId, seatNumber]
      );

      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'Seat is already booked' });
        return;
      }

      const bookingReference = generateBookingReference();
      const inserted = await client.query<{
        id: number;
        booking_reference: string;
        flight_id: number;
        user_id: number;
        seat_number: string;
        status: 'CONFIRMED' | 'CANCELLED';
        created_at: Date | string;
        cancelled_at: Date | string | null;
      }>(
        `INSERT INTO bookings (booking_reference, flight_id, user_id, seat_number, status)
         VALUES ($1, $2, $3, $4, 'CONFIRMED')
         RETURNING id, booking_reference, flight_id, user_id, seat_number, status, created_at, cancelled_at`,
        [bookingReference, flightId, user.id, seatNumber]
      );

      await client.query('COMMIT');

      const bookingRow = inserted.rows[0];
      res.status(201).json({
        booking: serializeBooking({
          ...bookingRow,
          flight_number: flight.flight_number,
          origin: flight.origin,
          destination: flight.destination,
          departure_time: flight.departure_time,
          price: flight.price,
        }),
      });
    } catch (err: unknown) {
      await client.query('ROLLBACK').catch(() => undefined);
      const pgCode =
        typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (pgCode === '23505') {
        res.status(409).json({ error: 'Seat is already booked' });
        return;
      }
      console.error('Create booking error:', err);
      res.status(500).json({ error: 'Failed to create booking' });
    } finally {
      client.release();
    }
  });

  // View authenticated customer's bookings
  router.get('/my', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await pool.query<BookingJoinRow>(
        `SELECT
           b.id,
           b.booking_reference,
           b.flight_id,
           b.user_id,
           b.seat_number,
           b.status,
           b.created_at,
           b.cancelled_at,
           f.flight_number,
           f.origin,
           f.destination,
           f.departure_time,
           f.price
         FROM bookings b
         INNER JOIN flights f ON f.id = b.flight_id
         WHERE b.user_id = $1
         ORDER BY b.created_at DESC, b.id DESC`,
        [user.id]
      );

      res.json({ bookings: result.rows.map(serializeBooking) });
    } catch (err) {
      console.error('Get my bookings error:', err);
      res.status(500).json({ error: 'Failed to load bookings' });
    }
  });

  // Cancel a booking so the seat becomes available again
  router.patch(
    '/:id/cancel',
    authenticate,
    async (req: AuthenticatedRequest, res) => {
      const user = req.user;
      if (!user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const bookingId = Number(req.params.id);
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        res.status(400).json({ error: 'Invalid booking ID' });
        return;
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existingResult = await client.query<{
          id: number;
          user_id: number;
          status: 'CONFIRMED' | 'CANCELLED';
        }>(
          `SELECT id, user_id, status
           FROM bookings
           WHERE id = $1
           FOR UPDATE`,
          [bookingId]
        );

        const booking = existingResult.rows[0];
        if (!booking) {
          await client.query('ROLLBACK');
          res.status(404).json({ error: 'Booking not found' });
          return;
        }

        if (booking.user_id !== user.id && user.role !== 'ADMIN') {
          await client.query('ROLLBACK');
          res
            .status(403)
            .json({ error: 'You can only cancel your own bookings' });
          return;
        }

        if (booking.status === 'CANCELLED') {
          await client.query('ROLLBACK');
          res.status(400).json({ error: 'Booking is already cancelled' });
          return;
        }

        await client.query(
          `UPDATE bookings
           SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [bookingId]
        );

        await client.query('COMMIT');

        const updatedResult = await pool.query<BookingJoinRow>(
          `SELECT
             b.id,
             b.booking_reference,
             b.flight_id,
             b.user_id,
             b.seat_number,
             b.status,
             b.created_at,
             b.cancelled_at,
             f.flight_number,
             f.origin,
             f.destination,
             f.departure_time,
             f.price
           FROM bookings b
           INNER JOIN flights f ON f.id = b.flight_id
           WHERE b.id = $1`,
          [bookingId]
        );

        res.json({ booking: serializeBooking(updatedResult.rows[0]) });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error('Cancel booking error:', err);
        res.status(500).json({ error: 'Failed to cancel booking' });
      } finally {
        client.release();
      }
    }
  );

  return router;
}

