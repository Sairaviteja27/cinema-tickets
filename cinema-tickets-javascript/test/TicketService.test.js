import TicketService from '../src/pairtest/TicketService.js';
import TicketValidator from '../src/pairtest/utils/validator/TicketValidator.js';
import TicketTypeRequest from '../src/pairtest/lib/TicketTypeRequest.js';
import InvalidPurchaseException from '../src/pairtest/lib/InvalidPurchaseException.js';
import { ticketCategories,ticketRules } from '../src/pairtest/config/TicketsConfig.js';
import messages from '../src/pairtest/utils/messages/messages.json'

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

    expect(() => ticketService.purchaseTickets(accountId, ...tickets))
      .toThrowError(new InvalidPurchaseException(messages.error_infant_only_not_allowed));
      
  });

  test('should reject purchases exceeding max ticket limit', () => {
    const accountId = 1;
    
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, ticketRules.MAX_TICKETS_PER_ORDER-2),
      new TicketTypeRequest(ticketCategories.CHILD, ticketRules.MAX_TICKETS_PER_ORDER+3)
    ];

    expect(() => ticketService.purchaseTickets(accountId, ...tickets))
      .toThrowError(new InvalidPurchaseException(messages.max_allowed_tickets_err
        .replace('{allowedTickets}', ticketRules.MAX_TICKETS_PER_ORDER)));
  });

  test('should handle payment service failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 1)];

    mockTicketPaymentService.makePayment.mockImplementation(() => {
      throw new Error('Payment service failed.');
    });

    expect(() => ticketService.purchaseTickets(accountId, ...tickets))
      .toThrowError(new InvalidPurchaseException(messages.payment_error));
  });

  test('should handle seat reservation failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 2)];

    mockSeatReservationService.reserveSeat.mockImplementation(() => {
      throw new Error('Seat reservation failed.');
    });

    expect(() => ticketService.purchaseTickets(accountId, ...tickets))
     .toThrowError(new InvalidPurchaseException(messages.seat_reservation_failed));
  });
});
