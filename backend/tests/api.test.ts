import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { newDb } from 'pg-mem';
import request from 'supertest';
import { createApp } from '../src/app';
import { runMigrations } from '../src/db/migrate';
import { DbPool } from '../src/db/pool';
import { seedDatabase, TEST_ACCOUNTS } from '../src/db/seed';

function createInMemoryPool(): DbPool {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  return pool as unknown as DbPool;
}

describe('Flight Booking System API', () => {
  let app: ReturnType<typeof createApp>;
  let adminToken = '';
  let customerAToken = '';
  let customerBToken = '';

  before(async () => {
    const pool = createInMemoryPool();
    await runMigrations(pool);
    await seedDatabase(pool);
    app = createApp(pool);

    const adminRes = await request(app).post('/api/auth/login').send({
      email: TEST_ACCOUNTS.admin.email,
      password: TEST_ACCOUNTS.admin.password,
    });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.body.token;

    const custARes = await request(app).post('/api/auth/login').send({
      email: TEST_ACCOUNTS.customer.email,
      password: TEST_ACCOUNTS.customer.password,
    });
    assert.equal(custARes.status, 200);
    customerAToken = custARes.body.token;

    const custBRes = await request(app).post('/api/auth/register').send({
      name: 'Kasun Silva',
      email: 'kasun@example.com',
      password: 'Password123!',
    });
    assert.equal(custBRes.status, 201);
    assert.equal(custBRes.body.user.role, 'CUSTOMER');
    customerBToken = custBRes.body.token;
  });

  it('searches seeded flights by origin, destination, and date', async () => {
    const res = await request(app)
      .get('/api/flights')
      .query({ from: 'Colombo', to: 'Dubai', date: '2026-12-25' });

    assert.equal(res.status, 200);
    assert.equal(res.body.flights.length, 1);
    const flight = res.body.flights[0];
    assert.equal(flight.flightNumber, 'UL225');
    assert.equal(flight.totalSeats, 30);
    assert.equal(flight.price, 85000);
    assert.equal(flight.bookedSeats, 0);
    assert.equal(flight.availableSeats, 30);
  });

  it('prevents customers from creating flights and allows admin CRUD', async () => {
    const forbidden = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        flightNumber: 'XX100',
        origin: 'Colombo',
        destination: 'Tokyo',
        departureTime: '2026-12-30T08:00',
        price: 150000,
        totalSeats: 42,
      });
    assert.equal(forbidden.status, 403);

    const created = await request(app)
      .post('/api/flights')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flightNumber: 'UL888',
        origin: 'Colombo',
        destination: 'Tokyo',
        departureTime: '2026-12-30T08:00',
        price: 150000,
        totalSeats: 42,
      });
    assert.equal(created.status, 201);
    const flightId = created.body.flight.id;
    assert.equal(created.body.flight.flightNumber, 'UL888');

    const updated = await request(app)
      .put(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        flightNumber: 'UL888',
        origin: 'Colombo',
        destination: 'Tokyo',
        departureTime: '2026-12-30T09:30',
        price: 155000,
        totalSeats: 48,
      });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.flight.price, 155000);
    assert.equal(updated.body.flight.totalSeats, 48);

    const deleted = await request(app)
      .delete(`/api/flights/${flightId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(deleted.status, 200);
    assert.equal(deleted.body.deleted, true);
  });

  it('allows booking a seat, blocks double booking, and frees seat on cancel', async () => {
    // Get UL504 (78 seats, includes 12A)
    const search = await request(app)
      .get('/api/flights')
      .query({ from: 'Colombo', to: 'London' });
    const flightId = search.body.flights[0].id;

    // Customer A books seat 12A
    const bookA = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({ flightId, seatNumber: '12A' });

    assert.equal(bookA.status, 201);
    assert.match(bookA.body.booking.bookingReference, /^SKY-[A-Z0-9]{6}$/);
    assert.equal(bookA.body.booking.seatNumber, '12A');
    assert.equal(bookA.body.booking.status, 'CONFIRMED');
    const bookingId = bookA.body.booking.id;

    // Seat map shows 12A booked and admin count shows bookedSeats = 1
    const detailAfterBook = await request(app).get(`/api/flights/${flightId}`);
    assert.equal(detailAfterBook.status, 200);
    assert.equal(detailAfterBook.body.flight.bookedSeats, 1);
    assert.equal(
      detailAfterBook.body.flight.availableSeats,
      detailAfterBook.body.flight.totalSeats - 1
    );
    const seat12A = detailAfterBook.body.seats.find(
      (s: { seatNumber: string }) => s.seatNumber === '12A'
    );
    assert.equal(seat12A.isBooked, true);

    // Customer B tries to book seat 12A -> 409 Conflict
    const bookBConflict = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ flightId, seatNumber: '12A' });
    assert.equal(bookBConflict.status, 409);
    assert.equal(bookBConflict.body.error, 'Seat is already booked');

    // Customer B cannot cancel Customer A's booking
    const forbiddenCancel = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerBToken}`);
    assert.equal(forbiddenCancel.status, 403);

    // Customer A cancels booking -> 12A becomes available again
    const cancelA = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set('Authorization', `Bearer ${customerAToken}`);
    assert.equal(cancelA.status, 200);
    assert.equal(cancelA.body.booking.status, 'CANCELLED');

    const detailAfterCancel = await request(app).get(
      `/api/flights/${flightId}`
    );
    assert.equal(detailAfterCancel.body.flight.bookedSeats, 0);
    const seat12AAfterCancel = detailAfterCancel.body.seats.find(
      (s: { seatNumber: string }) => s.seatNumber === '12A'
    );
    assert.equal(seat12AAfterCancel.isBooked, false);

    // Customer B can now book seat 12A
    const bookBAfterCancel = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({ flightId, seatNumber: '12A' });
    assert.equal(bookBAfterCancel.status, 201);
    assert.equal(bookBAfterCancel.body.booking.seatNumber, '12A');
  });

  it('handles concurrent booking attempts for the same seat safely', async () => {
    const search = await request(app)
      .get('/api/flights')
      .query({ from: 'Colombo', to: 'Dubai', date: '2026-12-25' });
    const flightId = search.body.flights[0].id;

    const results = await Promise.all([
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ flightId, seatNumber: '3C' }),
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ flightId, seatNumber: '3C' }),
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerAToken}`)
        .send({ flightId, seatNumber: '3C' }),
      request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerBToken}`)
        .send({ flightId, seatNumber: '3C' }),
    ]);

    const createdCount = results.filter((r) => r.status === 201).length;
    const conflictCount = results.filter((r) => r.status === 409).length;
    assert.equal(createdCount, 1);
    assert.equal(conflictCount, 3);
  });
});

