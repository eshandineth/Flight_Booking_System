import React, { useEffect, useState } from 'react';
import { Calendar, MapPin, Plane, Search, RotateCcw } from 'lucide-react';
import { api } from '../api/client';
import { Flight } from '../types';
import { formatFlightDateTime, formatPrice } from '../utils/format';

interface SearchFlightsPageProps {
  onSelectFlight: (flight: Flight) => void;
  refreshTrigger: number;
}

export function SearchFlightsPage({
  onSelectFlight,
  refreshTrigger,
}: SearchFlightsPageProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchFlights(filters = { from, to, date }) {
    setLoading(true);
    setError('');
    try {
      const res = await api.searchFlights(filters);
      setFlights(res.flights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flights');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFlights();
  }, [refreshTrigger]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchFlights({ from, to, date });
  }

  function handleReset() {
    setFrom('');
    setTo('');
    setDate('');
    fetchFlights({ from: '', to: '', date: '' });
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-content">
          <span className="eyebrow">Direct Flight Reservations</span>
          <h1>Find your next flight and pick your exact seat</h1>
          <p>
            Search by departure city, destination, and date — then choose your
            seat on the live aircraft cabin map.
          </p>
        </div>

        <form className="search-bar" onSubmit={handleSearch}>
          <label className="search-field">
            <span>From</span>
            <div className="input-icon">
              <MapPin size={16} />
              <input
                type="text"
                placeholder="e.g. Colombo"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
          </label>

          <label className="search-field">
            <span>To</span>
            <div className="input-icon">
              <MapPin size={16} />
              <input
                type="text"
                placeholder="e.g. Dubai"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </label>

          <label className="search-field">
            <span>Departure Date</span>
            <div className="input-icon">
              <Calendar size={16} />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </label>

          <div className="search-actions">
            <button type="submit" className="btn-primary">
              <Search size={16} />
              Search
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              title="Reset filters"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="section-block">
        <div className="section-header">
          <h2>Available Flights</h2>
          <span className="count-pill">
            {flights.length} {flights.length === 1 ? 'flight' : 'flights'} found
          </span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-state">Searching flights...</div>
        ) : flights.length === 0 ? (
          <div className="empty-card">
            <Plane size={32} />
            <h3>No flights match your search</h3>
            <p>
              Try clearing your filters or searching another destination or date.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
            >
              Show All Flights
            </button>
          </div>
        ) : (
          <div className="flight-grid">
            {flights.map((flight) => {
              const { dateLabel, timeLabel } = formatFlightDateTime(
                flight.departureTime
              );
              const soldOut = flight.availableSeats === 0;

              return (
                <article key={flight.id} className="flight-card">
                  <div className="flight-card-top">
                    <span className="flight-code-badge">
                      {flight.flightNumber}
                    </span>
                    <span
                      className={`availability-badge ${
                        soldOut ? 'sold-out' : 'available'
                      }`}
                    >
                      {soldOut
                        ? 'Sold Out'
                        : `${flight.availableSeats} of ${flight.totalSeats} seats left`}
                    </span>
                  </div>

                  <div className="flight-route">
                    <div>
                      <span className="city-label">From</span>
                      <strong>{flight.origin}</strong>
                    </div>
                    <div className="route-line">
                      <span className="dot" />
                      <span className="dashes" />
                      <Plane size={16} />
                      <span className="dashes" />
                      <span className="dot" />
                    </div>
                    <div className="align-right">
                      <span className="city-label">To</span>
                      <strong>{flight.destination}</strong>
                    </div>
                  </div>

                  <div className="flight-meta-row">
                    <div>
                      <span className="meta-label">Departure</span>
                      <strong>
                        {dateLabel} · {timeLabel}
                      </strong>
                    </div>
                    <div className="align-right">
                      <span className="meta-label">Price per seat</span>
                      <strong className="price-text">
                        {formatPrice(flight.price)}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary btn-full"
                    disabled={soldOut}
                    onClick={() => onSelectFlight(flight)}
                  >
                    {soldOut ? 'Flight Full' : 'Select Seat & Book'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

