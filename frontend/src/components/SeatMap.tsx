import { SeatInfo } from '../types';

interface SeatMapProps {
  seats: SeatInfo[];
  selectedSeat: string | null;
  onSelectSeat: (seatNumber: string) => void;
}

export function SeatMap({ seats, selectedSeat, onSelectSeat }: SeatMapProps) {
  // Group seats by row number
  const rowsMap = new Map<number, SeatInfo[]>();
  for (const seat of seats) {
    const existing = rowsMap.get(seat.row) ?? [];
    existing.push(seat);
    rowsMap.set(seat.row, existing);
  }
  const rows = Array.from(rowsMap.entries()).sort((a, b) => a[0] - b[0]);

  return (
    <div className="seat-map-wrapper">
      <div className="seat-legend">
        <div className="legend-item">
          <span className="legend-swatch available" />
          <span>Available</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch selected" />
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch booked" />
          <span>Booked</span>
        </div>
      </div>

      <div className="cabin-fuselage">
        <div className="cabin-nose">FRONT OF AIRCRAFT</div>

        <div className="cabin-col-headers">
          <span>A</span>
          <span>B</span>
          <span>C</span>
          <span className="aisle-gap" />
          <span>D</span>
          <span>E</span>
          <span>F</span>
        </div>

        <div className="cabin-rows">
          {rows.map(([rowNumber, rowSeats]) => {
            const byCol = new Map(rowSeats.map((s) => [s.column, s]));
            const leftCols = ['A', 'B', 'C'];
            const rightCols = ['D', 'E', 'F'];

            return (
              <div key={rowNumber} className="seat-row">
                {leftCols.map((col) => {
                  const seat = byCol.get(col);
                  if (!seat) {
                    return <span key={col} className="seat-spacer" />;
                  }
                  const isSelected = selectedSeat === seat.seatNumber;
                  return (
                    <button
                      key={seat.seatNumber}
                      type="button"
                      disabled={seat.isBooked}
                      onClick={() => onSelectSeat(seat.seatNumber)}
                      title={
                        seat.isBooked
                          ? `Seat ${seat.seatNumber} is already booked`
                          : `Select seat ${seat.seatNumber}`
                      }
                      className={`seat-btn ${
                        seat.isBooked
                          ? 'booked'
                          : isSelected
                          ? 'selected'
                          : 'available'
                      }`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}

                <span className="row-number">{rowNumber}</span>

                {rightCols.map((col) => {
                  const seat = byCol.get(col);
                  if (!seat) {
                    return <span key={col} className="seat-spacer" />;
                  }
                  const isSelected = selectedSeat === seat.seatNumber;
                  return (
                    <button
                      key={seat.seatNumber}
                      type="button"
                      disabled={seat.isBooked}
                      onClick={() => onSelectSeat(seat.seatNumber)}
                      title={
                        seat.isBooked
                          ? `Seat ${seat.seatNumber} is already booked`
                          : `Select seat ${seat.seatNumber}`
                      }
                      className={`seat-btn ${
                        seat.isBooked
                          ? 'booked'
                          : isSelected
                          ? 'selected'
                          : 'available'
                      }`}
                    >
                      {seat.seatNumber}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

