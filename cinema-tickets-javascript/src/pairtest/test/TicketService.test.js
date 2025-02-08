import TicketService from '../TicketService.js';
import TicketValidator from '../TicketValidator.js';
import TicketTypeRequest from '../lib/TicketTypeRequest.js';
import InvalidPurchaseException from '../lib/InvalidPurchaseException.js';
import { ticketCategories } from '../config/TicketsConfig.js';

// Mock dependencies
const mockTicketPaymentService = {
  makePayment: jest.fn()
};
const mockSeatReservationService = {
  reserveSeat: jest.fn()
};
const mockTicketValidator = new TicketValidator();

const ticketService = new TicketService(
  mockTicketValidator,
  mockTicketPaymentService,
  mockSeatReservationService
);

describe('TicketService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should process a valid ticket purchase', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 2),
      new TicketTypeRequest(ticketCategories.CHILD, 1)
    ];

    ticketService.purchaseTickets(accountId, ...tickets);

    expect(mockTicketPaymentService.makePayment).toHaveBeenCalledWith(accountId, 65); // 2 Adults (50) + 1 Child (15)
    expect(mockSeatReservationService.reserveSeat).toHaveBeenCalledWith(accountId, 3); // 3 seats (excluding infants)
  });

  test('should throw error for only infants ticket', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.INFANT, 2)
    ];
    
    expect(() => ticketService.purchaseTickets(accountId, ...tickets)).toThrow(InvalidPurchaseException);
  });

  test('should reject purchases exceeding max ticket limit', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 26)
    ];

    expect(() => ticketService.purchaseTickets(accountId, ...tickets)).toThrow(InvalidPurchaseException);
  });

  test('should handle payment service failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 1)];
    
    mockTicketPaymentService.makePayment.mockImplementation(() => {
      throw new Error('Payment service failed.');
    });
    
    expect(() => ticketService.purchaseTickets(accountId, ...tickets)).toThrow(InvalidPurchaseException);
  });

  test('should handle seat reservation failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 2)];

    mockSeatReservationService.reserveSeat.mockImplementation(() => {
      throw new Error('Seat reservation failed.');
    });

    expect(() => ticketService.purchaseTickets(accountId, ...tickets)).toThrow(InvalidPurchaseException);
  });
});
