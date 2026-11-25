const SEAT_COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export interface SeatInfo {
  seatNumber: string;
  row: number;
  column: string;
  isBooked: boolean;
}

/**
 * Generates deterministic aircraft seat codes (e.g. 1A..5F for 30 seats)
 * using 6-abreast seating (A-C | aisle | D-F).
 */
export function generateSeatCodes(totalSeats: number): string[] {
  const seats: string[] = [];
  for (let i = 0; i < totalSeats; i++) {
    const row = Math.floor(i / SEAT_COLUMNS.length) + 1;
    const col = SEAT_COLUMNS[i % SEAT_COLUMNS.length];
    seats.push(`${row}${col}`);
  }
  return seats;
}

export function isValidSeatForFlight(
  seatNumber: string,
  totalSeats: number
): boolean {
  const normalized = seatNumber.trim().toUpperCase();
  return generateSeatCodes(totalSeats).includes(normalized);
}

export function buildSeatMap(
  totalSeats: number,
  bookedSeatNumbers: Iterable<string>
): SeatInfo[] {
  const bookedSet = new Set(
    Array.from(bookedSeatNumbers, (s) => s.trim().toUpperCase())
  );
  const seats: SeatInfo[] = [];

  for (let i = 0; i < totalSeats; i++) {
    const row = Math.floor(i / SEAT_COLUMNS.length) + 1;
    const column = SEAT_COLUMNS[i % SEAT_COLUMNS.length];
    const seatNumber = `${row}${column}`;
    seats.push({
      seatNumber,
      row,
      column,
      isBooked: bookedSet.has(seatNumber),
    });
  }

  return seats;
}

