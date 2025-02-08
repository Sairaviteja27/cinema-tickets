import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import { ticketCategories, ticketCost } from './config/TicketsConfig.js';
import messages from './utils/messages/messages.json' with { type: 'json' };
import logger from './utils/logger/logger.js';

export default class TicketService {
  constructor(ticketValidator, ticketPaymentService, seatReservationService) {
    this.ticketValidator = ticketValidator;
    this.ticketPaymentService = ticketPaymentService;
    this.seatReservationService = seatReservationService;
  }

  #calculateTotalCost(ticketRequests) {
    return ticketRequests.reduce((totalCost, request) => {
      if (!(request instanceof TicketTypeRequest)) {
        // Assumption: JSON.stringify(request) will never throw error.
        logger.error(`${messages.invalid_ticket_type_request}: ${JSON.stringify(request)}`);
        throw new TypeError(messages.invalid_request);
      }
      const ticketType = request.getTicketType();
      const noOfTickets = request.getNoOfTickets();
      return totalCost + (ticketCost[ticketType] ?? 0) * noOfTickets;
    }, 0);
  }

  #calculateTotalSeats(ticketRequests) {
    return ticketRequests
      .filter(request => {
        if (!(request instanceof TicketTypeRequest)) {
          // Assumption: JSON.stringify(request) will never throw error.
          logger.error(`${messages.invalid_ticket_type_request}: ${JSON.stringify(request)}`);
          throw new TypeError(messages.invalid_request);
        }
        return request.getTicketType() !== ticketCategories.INFANT;
      })
      .reduce((totalSeats, request) => totalSeats + request.getNoOfTickets(), 0);
  }

  purchaseTickets(accountId, ...ticketTypeRequests) {
    const ticketSummary = ticketTypeRequests.reduce((acc, request) => {
      if (!(request instanceof TicketTypeRequest)) {
        logger.error(`${messages.invalid_ticket_type_request}: ${JSON.stringify(request)}`);
        throw new TypeError(messages.invalid_request);
      }
      const ticketType = request.getTicketType();
      acc[ticketType] = (acc[ticketType] || 0) + request.getNoOfTickets();
      return acc;
    }, {});

    try {
      this.ticketValidator.verifyTicketOrder(ticketSummary);
    } catch (errorMsg) {
      throw new InvalidPurchaseException(errorMsg);
    }

    try {
      const totalSeats = this.#calculateTotalSeats(ticketTypeRequests);

      // Reserve seats first to ensure availability before proceeding with payment.
      // This prevents scenarios where users pay but later find out that the seat is unavailable.
      this.seatReservationService.reserveSeat(accountId, totalSeats);

      logger.info(`${messages.seat_reservation_successful} ${totalSeats}`);

      try {
        const totalCost = this.#calculateTotalCost(ticketTypeRequests);
        this.ticketPaymentService.makePayment(accountId, totalCost);

        logger.info(`${messages.payment_successful} ${totalCost}`);
      } catch (paymentError) {
        if (paymentError instanceof TypeError) {
          logger.error(`Payment Error: ${paymentError.message}`);
          // Assumption: Standardizing the error format and also as third-party errors can sometimes be ambiguous
          throw new InvalidPurchaseException(messages.payment_error);
        }

        logger.warn(`Payment Error: ${paymentError.message}`);

        // If payment fails, implement rollback for seat reservation or retry payment.
        // Optionally, if the amount is debited, notify the customer to wait before retrying.

        throw new InvalidPurchaseException(messages.payment_error);
      }
    } catch (seatError) {
      if (seatError instanceof TypeError) {
        logger.error(`Seat Reservation Error: ${seatError.message}`);
        throw new InvalidPurchaseException(messages.seat_reservation_error);
      }

      // Assumption: This error occurs due to valid conditions, such as seat unavailability and may even be third-party server or network failures
      logger.warn(`Seat Reservation Error: ${seatError.message}`);
      throw new InvalidPurchaseException(messages.seat_reservation_failed);
    }
  }
}