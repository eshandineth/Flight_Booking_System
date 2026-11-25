import { useEffect, useState } from 'react';
import { CheckCircle2, Plane, RefreshCw, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Booking, Flight, SeatInfo } from '../types';
import { formatFlightDateTime, formatPrice } from '../utils/format';
import { SeatMap } from './SeatMap';

interface SeatSelectionModalProps {
  flight: Flight | null;
  onClose: () => void;
  onRequireAuth: () => void;
  onBooked: (booking: Booking) => void;
}

export function SeatSelectionModal({
  flight,
  onClose,
  onRequireAuth,
  onBooked,
}: SeatSelectionModalProps) {
  const { user } = useAuth();
  const [seats, setSeats] = useState<SeatInfo[]>([]);
  const [freshFlight, setFreshFlight] = useState<Flight | null>(flight);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(
    null
  );

  useEffect(() => {
    if (!flight) return;
    setSelectedSeat(null);
    setError('');
    setConfirmedBooking(null);
    loadSeatMap(flight.id);
  }, [flight]);

  async function loadSeatMap(flightId: number) {
    setLoading(true);
    setError('');
    try {
      const data = await api.getFlightDetails(flightId);
      setFreshFlight(data.flight);
      setSeats(data.seats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load seat map');
    } finally {
      setLoading(false);
    }
  }

  if (!flight) return null;

  const displayFlight = freshFlight ?? flight;
  const { dateLabel, timeLabel } = formatFlightDateTime(
    displayFlight.departureTime
  );

  async function handleConfirmBooking() {
    if (!selectedSeat) return;
    if (!user) {
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await api.createBooking({
        flightId: displayFlight.id,
        seatNumber: selectedSeat,
      });
      setConfirmedBooking(res.booking);
      setSelectedSeat(null);
      await loadSeatMap(displayFlight.id);
      onBooked(res.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book seat');
      // Refresh seat map so newly taken seats are immediately visible
      await loadSeatMap(displayFlight.id);
      setSelectedSeat(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seat-modal-title"
      >
        <div className="modal-header">
          <div>
            <div className="flight-pill-row">
              <span className="flight-code-badge">
                {displayFlight.flightNumber}
              </span>
              <span className="muted-text">
                {dateLabel} at {timeLabel}
              </span>
            </div>
            <h2 id="seat-modal-title" className="route-heading">
              {displayFlight.origin} <Plane size={18} />{' '}
              {displayFlight.destination}
            </h2>
          </div>

          <div className="modal-header-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() => loadSeatMap(displayFlight.id)}
              title="Refresh seat availability"
              aria-label="Refresh seat availability"
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {confirmedBooking ? (
          <div className="confirmation-panel">
            <CheckCircle2 size={44} className="success-icon" />
            <h3>Booking Confirmed!</h3>
            <p className="muted-text">
              Your seat has been reserved on flight{' '}
              <strong>{confirmedBooking.flight.flightNumber}</strong>.
            </p>
            <div className="booking-ref-box">
              <span>Booking Reference</span>
              <strong>{confirmedBooking.bookingReference}</strong>
            </div>
            <div className="confirmation-meta">
              <span>
                Route: {confirmedBooking.flight.origin} →{' '}
                {confirmedBooking.flight.destination}
              </span>
              <span>Seat: {confirmedBooking.seatNumber}</span>
              <span>Fare: {formatPrice(confirmedBooking.flight.price)}</span>
            </div>
            <div className="confirmation-actions">
              <button type="button" className="btn-primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
              <div className="loading-state">Loading aircraft seat map...</div>
            ) : (
              <div className="seat-modal-body">
                <SeatMap
                  seats={seats}
                  selectedSeat={selectedSeat}
                  onSelectSeat={setSelectedSeat}
                />

                <div className="booking-sidebar">
                  <h3>Booking Summary</h3>
                  <div className="summary-row">
                    <span>Flight</span>
                    <strong>{displayFlight.flightNumber}</strong>
                  </div>
                  <div className="summary-row">
                    <span>Route</span>
                    <strong>
                      {displayFlight.origin} → {displayFlight.destination}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Departure</span>
                    <strong>
                      {dateLabel}, {timeLabel}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Available Seats</span>
                    <strong>
                      {displayFlight.availableSeats} / {displayFlight.totalSeats}
                    </strong>
                  </div>
                  <div className="summary-row">
                    <span>Selected Seat</span>
                    <strong className="seat-highlight">
                      {selectedSeat ?? 'None selected'}
                    </strong>
                  </div>
                  <div className="summary-divider" />
                  <div className="summary-row total">
                    <span>Total Fare</span>
                    <strong>{formatPrice(displayFlight.price)}</strong>
                  </div>

                  {!user && (
                    <p className="signin-hint">
                      Sign in as a Customer or Admin to complete your booking.
                    </p>
                  )}

                  <button
                    type="button"
                    className="btn-primary btn-full"
                    disabled={!selectedSeat || submitting}
                    onClick={handleConfirmBooking}
                  >
                    {submitting
                      ? 'Confirming Seat...'
                      : !user
                      ? 'Sign In to Book Seat'
                      : selectedSeat
                      ? `Book Seat ${selectedSeat}`
                      : 'Select a Seat First'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

