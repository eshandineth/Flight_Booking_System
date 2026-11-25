import { useEffect, useState } from 'react';
import { Plane, Ticket, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { Booking } from '../types';
import { formatFlightDateTime, formatPrice } from '../utils/format';

interface MyBookingsPageProps {
  refreshTrigger: number;
  onBookingChanged: () => void;
  onExploreFlights: () => void;
}

export function MyBookingsPage({
  refreshTrigger,
  onBookingChanged,
  onExploreFlights,
}: MyBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadBookings() {
    setLoading(true);
    setError('');
    try {
      const res = await api.getMyBookings();
      setBookings(res.bookings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [refreshTrigger]);

  async function handleCancel(booking: Booking) {
    setCancellingId(booking.id);
    setError('');
    setMessage('');
    try {
      await api.cancelBooking(booking.id);
      setMessage(
        `Booking ${booking.bookingReference} (Seat ${booking.seatNumber}) cancelled. The seat is now available again.`
      );
      await loadBookings();
      onBookingChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="page-stack">
      <div className="section-header">
        <div>
          <h1>My Bookings</h1>
          <p className="muted-text">
            View your booking references or cancel a reservation to release the
            seat.
          </p>
        </div>
        <span className="count-pill">{bookings.length} total</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {loading ? (
        <div className="loading-state">Loading your bookings...</div>
      ) : bookings.length === 0 ? (
        <div className="empty-card">
          <Ticket size={32} />
          <h3>No bookings yet</h3>
          <p>Search available flights and select a seat to make your first booking.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={onExploreFlights}
          >
            Browse Flights
          </button>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => {
            const { dateLabel, timeLabel } = formatFlightDateTime(
              booking.flight.departureTime
            );
            const isConfirmed = booking.status === 'CONFIRMED';

            return (
              <article
                key={booking.id}
                className={`booking-card ${
                  isConfirmed ? '' : 'booking-cancelled'
                }`}
              >
                <div className="booking-card-main">
                  <div className="booking-badges">
                    <span className="ref-badge">
                      Ref: {booking.bookingReference}
                    </span>
                    <span className="seat-pill">Seat {booking.seatNumber}</span>
                    <span
                      className={`status-badge ${
                        isConfirmed ? 'confirmed' : 'cancelled'
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  <div className="booking-route-line">
                    <span className="flight-code-badge">
                      {booking.flight.flightNumber}
                    </span>
                    <strong>
                      {booking.flight.origin} <Plane size={15} />{' '}
                      {booking.flight.destination}
                    </strong>
                  </div>

                  <div className="booking-details-row">
                    <span>
                      Departure: {dateLabel} at {timeLabel}
                    </span>
                    <span>Fare: {formatPrice(booking.flight.price)}</span>
                  </div>
                </div>

                <div className="booking-card-actions">
                  {isConfirmed ? (
                    <button
                      type="button"
                      className="btn-danger-outline"
                      disabled={cancellingId === booking.id}
                      onClick={() => handleCancel(booking)}
                    >
                      <XCircle size={16} />
                      {cancellingId === booking.id
                        ? 'Cancelling...'
                        : 'Cancel Booking'}
                    </button>
                  ) : (
                    <span className="muted-text">Cancelled</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

