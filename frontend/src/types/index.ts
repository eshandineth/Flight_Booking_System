export type UserRole = 'CUSTOMER' | 'ADMIN';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

export interface Flight {
  id: number;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  price: number;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
}

export interface SeatInfo {
  seatNumber: string;
  row: number;
  column: string;
  isBooked: boolean;
}

export interface Booking {
  id: number;
  bookingReference: string;
  flightId: number;
  userId: number;
  seatNumber: string;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  cancelledAt: string | null;
  flight: {
    id: number;
    flightNumber: string;
    origin: string;
    destination: string;
    departureTime: string;
    price: number;
  };
}

export interface FlightFormInput {
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  price: number;
  totalSeats: number;
}

