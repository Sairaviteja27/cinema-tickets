import TicketService from '../src/pairtest/TicketService.js';
import TicketTypeRequest from '../src/pairtest/lib/TicketTypeRequest.js';
import InvalidPurchaseException from '../src/pairtest/lib/InvalidPurchaseException.js';
import { ticketCategories, ticketRules } from '../src/pairtest/config/TicketsConfig.js';
import messages from '../src/pairtest/utils/messages/messages.json'

// Mock dependencies
const mockTicketPaymentService = {
  makePayment: jest.fn()
};
const mockSeatReservationService = {
  reserveSeat: jest.fn()
};

const ticketService = new TicketService(
  mockTicketPaymentService,
  mockSeatReservationService
);

describe('TicketService Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock implementations to default
    mockTicketPaymentService.makePayment.mockImplementation(() => { });
    mockSeatReservationService.reserveSeat.mockImplementation(() => { });
  });

  test('should process a valid ticket purchase', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 2),
      new TicketTypeRequest(ticketCategories.CHILD, 1),
      new TicketTypeRequest(ticketCategories.INFANT, 1)
    ];

    const result = ticketService.purchaseTickets(accountId, ...tickets);

    // Assert: Check if payment and seat reservation methods are called with expected arguments
    expect(mockTicketPaymentService.makePayment).toHaveBeenCalledWith(accountId, 65); // 2 Adults (50) + 1 Child (15)
    expect(mockSeatReservationService.reserveSeat).toHaveBeenCalledWith(accountId, 3); // 3 seats (excluding infants)

    expect(result).toMatchObject({
      message: messages.purchase_successful,
      transactionId: expect.any(String),
    });
  })

  test('should throw error for only infants ticket', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.INFANT, 2)
    ];

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException); // Ensures it's the correct error type
      expect(error.message).toBe(messages.error_adult_required); // Ensures the message is correct
    }
  });

  test('should throw error for duplicate ticket types', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 1),
      new TicketTypeRequest(ticketCategories.ADULT, 3),
      new TicketTypeRequest(ticketCategories.INFANT, 2)

    ];

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException);
      expect(error.message).toBe(messages.duplicate_ticket_type_error);
    }
  });



  test('should reject purchases exceeding max ticket limit', () => {
    const accountId = 1;

    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, ticketRules.MAX_TICKETS_PER_ORDER - 2),
      new TicketTypeRequest(ticketCategories.CHILD, ticketRules.MAX_TICKETS_PER_ORDER + 3)
    ];

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException);
      expect(error.message).toBe(messages.max_allowed_tickets_err
        .replace('{allowedTickets}', ticketRules.MAX_TICKETS_PER_ORDER));
    }
  });

  test('should handle payment service failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 1)];

    mockTicketPaymentService.makePayment.mockImplementation(() => {
      throw new Error('Payment service failed.');
    });

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException);
      expect(error.message).toBe(messages.payment_error);
    }
  });

  test('should handle seat reservation failure', () => {
    const accountId = 1;
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 2)];

    mockSeatReservationService.reserveSeat.mockImplementation(() => {
      throw new Error('Seat reservation failed.');
    });

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException);
      expect(error.message).toBe(messages.seat_reservation_failed);
    }
  });

  test('should throw error for invalid account ID', () => {
    const accountId = 0; // Invalid account ID
    const tickets = [new TicketTypeRequest(ticketCategories.ADULT, 1)];

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(messages.invalid_request);
    }
  });

  test('should throw error for invalid TicketTypeRequest instance', () => {
    const accountId = 1;
    const invalidRequest = { ticketType: ticketCategories.ADULT, noOfTickets: 2 };

    expect(() => {
      ticketService.purchaseTickets(accountId, invalidRequest);
    }).toThrow(TypeError);

    expect(() => ticketService.purchaseTickets(accountId, invalidRequest))
      .toThrowError(new TypeError(messages.invalid_request));
  });

  test('should throw error for too many infants without enough adults', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 1),
      new TicketTypeRequest(ticketCategories.INFANT, 3)
    ];

    try {
      ticketService.purchaseTickets(accountId, ...tickets);
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidPurchaseException);
      expect(error.message).toBe(messages.error_too_many_infants);
    }
  });

  test('should throw error if no tickets are purchased', () => {
    const accountId = 1;
    try {
      ticketService.purchaseTickets(accountId);
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError);
      expect(error.message).toBe(messages.invalid_request);
    }
  });

  test('should process a valid purchase including infants (infants don\'t count for seats)', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, 2),
      new TicketTypeRequest(ticketCategories.INFANT, 2)
    ];
    const result = ticketService.purchaseTickets(accountId, ...tickets);
    expect(mockTicketPaymentService.makePayment).toHaveBeenCalledWith(accountId, 50);
    // Only adult seats are reserved, not infants
    expect(mockSeatReservationService.reserveSeat).toHaveBeenCalledWith(accountId, 2);

    expect(result).toMatchObject({
      message: messages.purchase_successful,
      transactionId: expect.any(String),
    });
  });

  test('should allow purchasing exactly MAX_TICKETS_PER_ORDER tickets', () => {
    const accountId = 1;
    const tickets = [
      new TicketTypeRequest(ticketCategories.ADULT, ticketRules.MAX_TICKETS_PER_ORDER)
    ];
    expect(() => ticketService.purchaseTickets(accountId, ...tickets)).not.toThrow();
  });
});
