import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '../api/client';
import { Flight, FlightFormInput } from '../types';
import { formatFlightDateTime, formatPrice } from '../utils/format';

interface AdminDashboardPageProps {
  refreshTrigger: number;
  onFlightsChanged: () => void;
}

const EMPTY_FORM: FlightFormInput = {
  flightNumber: '',
  origin: '',
  destination: '',
  departureTime: '2026-12-25T10:30',
  price: 85000,
  totalSeats: 30,
};

export function AdminDashboardPage({
  refreshTrigger,
  onFlightsChanged,
}: AdminDashboardPageProps) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [form, setForm] = useState<FlightFormInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function loadFlights() {
    setLoading(true);
    setError('');
    try {
      const res = await api.searchFlights({});
      setFlights(res.flights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flights');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFlights();
  }, [refreshTrigger]);

  function openAddModal() {
    setEditingFlight(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  }

  function openEditModal(flight: Flight) {
    const { inputValue } = formatFlightDateTime(flight.departureTime);
    setEditingFlight(flight);
    setForm({
      flightNumber: flight.flightNumber,
      origin: flight.origin,
      destination: flight.destination,
      departureTime: inputValue,
      price: flight.price,
      totalSeats: flight.totalSeats,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    setFeedback('');

    try {
      if (editingFlight) {
        await api.updateFlight(editingFlight.id, form);
        setFeedback(`Updated flight ${form.flightNumber.toUpperCase()}.`);
      } else {
        await api.createFlight(form);
        setFeedback(`Added flight ${form.flightNumber.toUpperCase()}.`);
      }
      setModalOpen(false);
      await loadFlights();
      onFlightsChanged();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save flight'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(flight: Flight) {
    const confirmed = window.confirm(
      `Delete flight ${flight.flightNumber} (${flight.origin} → ${flight.destination})?` +
        (flight.bookedSeats > 0
          ? ` This flight currently has ${flight.bookedSeats} booked seat(s).`
          : '')
    );
    if (!confirmed) return;

    setError('');
    setFeedback('');
    try {
      await api.deleteFlight(flight.id);
      setFeedback(`Deleted flight ${flight.flightNumber}.`);
      await loadFlights();
      onFlightsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete flight');
    }
  }

  const totalSeatsAll = flights.reduce((sum, f) => sum + f.totalSeats, 0);
  const totalBookedAll = flights.reduce((sum, f) => sum + f.bookedSeats, 0);
  const totalAvailableAll = flights.reduce(
    (sum, f) => sum + f.availableSeats,
    0
  );

  return (
    <div className="page-stack">
      <div className="section-header">
        <div>
          <h1>Admin Flight Dashboard</h1>
          <p className="muted-text">
            Monitor seat occupancy across flights and add, edit, or remove
            flight schedules.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          Add Flight
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span>Total Flights</span>
          <strong>{flights.length}</strong>
        </div>
        <div className="stat-card">
          <span>Total Capacity</span>
          <strong>{totalSeatsAll} seats</strong>
        </div>
        <div className="stat-card">
          <span>Booked Seats</span>
          <strong className="text-indigo">{totalBookedAll}</strong>
        </div>
        <div className="stat-card">
          <span>Available Seats</span>
          <strong className="text-emerald">{totalAvailableAll}</strong>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {feedback && <div className="alert alert-success">{feedback}</div>}

      <div className="table-card">
        {loading ? (
          <div className="loading-state">Loading flight inventory...</div>
        ) : flights.length === 0 ? (
          <div className="empty-card">
            <h3>No flights configured</h3>
            <p>Add your first flight to start accepting bookings.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Flight #</th>
                  <th>Route</th>
                  <th>Departure</th>
                  <th>Price</th>
                  <th>Total Seats</th>
                  <th>Booked</th>
                  <th>Available</th>
                  <th className="align-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => {
                  const { dateLabel, timeLabel } = formatFlightDateTime(
                    flight.departureTime
                  );
                  return (
                    <tr key={flight.id}>
                      <td>
                        <span className="flight-code-badge">
                          {flight.flightNumber}
                        </span>
                      </td>
                      <td>
                        <strong>
                          {flight.origin} → {flight.destination}
                        </strong>
                      </td>
                      <td>
                        {dateLabel}
                        <div className="table-subtext">{timeLabel}</div>
                      </td>
                      <td>{formatPrice(flight.price)}</td>
                      <td>{flight.totalSeats}</td>
                      <td>
                        <span className="count-chip booked">
                          {flight.bookedSeats}
                        </span>
                      </td>
                      <td>
                        <span className="count-chip available">
                          {flight.availableSeats}
                        </span>
                      </td>
                      <td className="align-right">
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn-secondary-sm"
                            onClick={() => openEditModal(flight)}
                            title="Edit flight"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger-sm"
                            onClick={() => handleDelete(flight)}
                            title="Delete flight"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="modal-card modal-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="flight-form-title"
          >
            <div className="modal-header">
              <h2 id="flight-form-title">
                {editingFlight ? 'Edit Flight' : 'Add New Flight'}
              </h2>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}

            <form onSubmit={handleSave} className="form-stack">
              <label className="field">
                <span>Flight Number</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. UL225"
                  value={form.flightNumber}
                  onChange={(e) =>
                    setForm({ ...form, flightNumber: e.target.value })
                  }
                />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>From (Origin)</span>
                  <input
                    type="text"
                    required
                    placeholder="Colombo"
                    value={form.origin}
                    onChange={(e) =>
                      setForm({ ...form, origin: e.target.value })
                    }
                  />
                </label>

                <label className="field">
                  <span>To (Destination)</span>
                  <input
                    type="text"
                    required
                    placeholder="Dubai"
                    value={form.destination}
                    onChange={(e) =>
                      setForm({ ...form, destination: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className="field">
                <span>Departure Date & Time</span>
                <input
                  type="datetime-local"
                  required
                  value={form.departureTime}
                  onChange={(e) =>
                    setForm({ ...form, departureTime: e.target.value })
                  }
                />
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Price (Rs.)</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step="1"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: Number(e.target.value) })
                    }
                  />
                </label>

                <label className="field">
                  <span>Total Seats</span>
                  <input
                    type="number"
                    required
                    min={1}
                    max={600}
                    value={form.totalSeats}
                    onChange={(e) =>
                      setForm({ ...form, totalSeats: Number(e.target.value) })
                    }
                  />
                </label>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : editingFlight
                    ? 'Save Changes'
                    : 'Create Flight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

