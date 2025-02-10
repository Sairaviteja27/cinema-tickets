import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import { ticketCategories, ticketCost } from './config/TicketsConfig.js';
import messages from './utils/messages/messages.json' with { type: 'json' };
import logger from './utils/logger/logger.js';
import SnowflakeIDGenerator from './utils/Snowflake/SnowflakeIDGenerator.js'


export default class TicketService {
  constructor(ticketValidator, ticketPaymentService, seatReservationService, machineId = 1) {
    this.ticketValidator = ticketValidator;
    this.ticketPaymentService = ticketPaymentService;
    this.seatReservationService = seatReservationService;
    this.snowflakeGenerator = new SnowflakeIDGenerator(machineId);
  }

  #calculateTotalCost(ticketRequests) {
    return ticketRequests.reduce((totalCost, request) => {
      if (!(request instanceof TicketTypeRequest)) {
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
          logger.error(`${messages.invalid_ticket_type_request}: ${JSON.stringify(request)}`);
          throw new TypeError(messages.invalid_request);
        }
        return request.getTicketType() !== ticketCategories.INFANT;
      })
      .reduce((totalSeats, request) => totalSeats + request.getNoOfTickets(), 0);
  }

  /**
  * Should only have private methods other than the one below.
  */
  purchaseTickets(accountId, ...ticketTypeRequests) {
    const transactionId = this.snowflakeGenerator.generateId();
    logger.info(`Transaction ID: ${transactionId} - Account ID: ${accountId}`);
    if (accountId <= 0) {
      logger.error(`Transaction ID: ${transactionId} - ${messages.invalid_ticket_type_request}: Invalid accountId: ${accountId}`);
      throw new TypeError(messages.invalid_request);
    }

    const ticketSummary = ticketTypeRequests.reduce((acc, request) => {
      if (!(request instanceof TicketTypeRequest)) {
        logger.error(`Transaction ID: ${transactionId} - ${messages.invalid_ticket_type_request}: ${JSON.stringify(request)}`);
        throw new TypeError(messages.invalid_request);
      }
      const ticketType = request.getTicketType();
      acc[ticketType] = (acc[ticketType] || 0) + request.getNoOfTickets();
      return acc;
    }, {});

    try {
      this.ticketValidator.verifyTicketOrder(ticketSummary);
    } catch (errorMsg) {
      throw errorMsg;
    }


    // ─── Seat Reservation Logic ────────────────────────────────────────────
    try {
      const totalSeats = this.#calculateTotalSeats(ticketTypeRequests);
      logger.info(`Transaction ID: ${transactionId} - Account ID: ${accountId} - Total Seats: ${totalSeats}`);
    
      // Reserve seats first to ensure availability before proceeding with payment.
      // This prevents scenarios where users pay but later find out that the seat is unavailable.
      this.seatReservationService.reserveSeat(accountId, totalSeats);
      logger.info(`Transaction ID: ${transactionId} - ${messages.seat_reservation_successful} ${totalSeats}`);
    } catch (seatError) {
      if (seatError instanceof TypeError) {
        logger.error(`Transaction ID: ${transactionId} - Seat Reservation Error: ${seatError.message}`);
        throw new InvalidPurchaseException(messages.seat_reservation_error);
      }
    
      // This error might occur due to valid scenarios like a seat already being reserved by another process 
      // so logging with warn level.
      logger.warn(`Transaction ID: ${transactionId} - Seat Reservation Error: ${seatError.message}`);
      throw new InvalidPurchaseException(messages.seat_reservation_failed);
    }

    // ─── Payment Processing Logic ───────────────────────────────────────────
    try {
      const totalCost = this.#calculateTotalCost(ticketTypeRequests);
      this.ticketPaymentService.makePayment(accountId, totalCost);
    
      logger.info(`Transaction ID: ${transactionId} - ${messages.payment_successful} ${totalCost}`);
    
      // Returning a structured response
      return {
        message: "Purchase successful",
        transactionId: transactionId
      };
    } catch (paymentError) {
      if (paymentError instanceof TypeError) {
        logger.error(`Transaction ID: ${transactionId} - Payment Error: ${paymentError.message}`);
        // Assumption: Standardizing the error format and also as third-party errors can sometimes be ambiguous
        throw new InvalidPurchaseException(messages.payment_error);
      }
      // This error might occur due to payment processing issues such as at payment gateway, bank
      // so logging with warn level.
      logger.warn(`Transaction ID: ${transactionId} - Payment Error: ${paymentError.message}`);
      
      // Assumption: For a valid request, payment processing is always expected to succeed. 
      // Therefore, retrying payments or handling refunds is not required.
      throw new InvalidPurchaseException(messages.payment_error);
    }
  }
}