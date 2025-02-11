import TicketTypeRequest from './lib/TicketTypeRequest.js';
import InvalidPurchaseException from './lib/InvalidPurchaseException.js';
import { ticketCategories, ticketCost, ticketRules } from './config/TicketsConfig.js';
import messages from './utils/messages/messages.json' with { type: 'json' };
import logger from './utils/logger/logger.js';
import SnowflakeIDGenerator from './utils/Snowflake/SnowflakeIDGenerator.js'

export default class TicketService {

  /**
   * Initializes a new instance of the TicketService.
   * @param {Object} ticketPaymentService - Service for handling ticket payments.
   * @param {Object} seatReservationService - Service for handling seat reservations.
   * @param {number} [machineId=1] - Machine ID for the Snowflake ID generator.
   */
  constructor(ticketPaymentService, seatReservationService, machineId = 1) {
    this.ticketPaymentService = ticketPaymentService;
    this.seatReservationService = seatReservationService;
    this.snowflakeGenerator = new SnowflakeIDGenerator(machineId);
  }

  // All helper methods have been made private as per task requirement

  /**
   * Calculates the total cost of the ticket requests.
   * @param {TicketTypeRequest[]} ticketRequests - Array of ticket requests.
   * @returns {number} - The total cost of all requested tickets.
   */
  #calculateTotalCost(ticketRequests) {
    return ticketRequests.reduce((totalCost, request) => {
      const ticketType = request.getTicketType();
      const noOfTickets = request.getNoOfTickets();
      return totalCost + (ticketCost[ticketType] ?? 0) * noOfTickets;
    }, 0);
  }

  /**
   * Calculates the total number of seats required, excluding infants who do not require a seat.
   * @param {TicketTypeRequest[]} ticketRequests - Array of ticket requests.
   * @returns {number} - Total number of seats required.
   */
  #calculateTotalSeats(ticketRequests) {
    return ticketRequests
      .filter(request => {
        return request.getTicketType() !== ticketCategories.INFANT;
      })
      .reduce((totalSeats, request) => totalSeats + request.getNoOfTickets(), 0);
  }

  /**
   * Calculates the total number of tickets requested.
   * @param {Object} ticketRequests - An object mapping ticket types to their request counts.
   * @returns {number} - The total number of tickets requested.
   */
  #calculateTotalTickets(ticketRequests) {
    return Object.values(ticketRequests).reduce((total, count) => total + (count ?? 0), 0);
  }

  /**
   * Safely converts an object to a JSON string.
   * @param {any} obj - The object to be converted.
   * @returns {string} - The JSON string representation or a fallback value if serialization fails.
   */
  #safeStringify(obj) {
    try {
      if (obj === undefined) return "undefined";
      if (obj === null) return "null";
      if (Array.isArray(obj) && obj.length === 0) return "[] (empty array)";
      return JSON.stringify(obj);
    } catch (error) {
      return "[Unserializable Object]";
    }
  }

  /**
   * Validates the purchase request parameters.
   * Ensures accountId is valid, ticketTypeRequests are well-formed, and no duplicate ticket types exist.
   * 
   * @param {number} accountId - The account ID making the purchase request.
   * @param {TicketTypeRequest[]} ticketTypeRequests - Array of ticket requests.
   * @param {string} transactionId - The unique transaction ID for logging.
   * @throws {TypeError} If accountId is invalid or ticketTypeRequests are not properly formatted.
   * @throws {InvalidPurchaseException} If duplicate ticket types are detected.
   */
  #validatePurchaseRequest(accountId, ticketTypeRequests, transactionId) {
    if (!Number.isInteger(accountId) || accountId <= 0) {
      logger.error(`Transaction ID: ${transactionId} - Invalid accountId: ${accountId}`);
      throw new TypeError(messages.invalid_request);
    }

    if (
      !Array.isArray(ticketTypeRequests) ||
      ticketTypeRequests.length === 0 ||
      !ticketTypeRequests.every(request => request instanceof TicketTypeRequest)
    ) {
      logger.error(`Transaction ID: ${transactionId} - ${messages.invalid_ticket_type_request}. Provided ticketTypeRequests: ${this.#safeStringify(ticketTypeRequests)}`);
      throw new TypeError(messages.invalid_request);
    }

    // Create a Set from ticketTypeRequests to check for duplicate ticket types
    const uniqueTicketTypes = new Set(ticketTypeRequests.map(request => request.getTicketType()));

    // If the length of the Set and the original array are different, there are duplicates
    if (uniqueTicketTypes.size !== ticketTypeRequests.length) {
      logger.error(`Transaction ID: ${transactionId} - Duplicate ticket types detected.`);
      throw new InvalidPurchaseException(messages.duplicate_ticket_type_error);
    }
  }

  /**
   * Verifies that the total ticket count is within allowed limits.
   * @param {Object} ticketRequests - An object mapping ticket types to their requests.
   * @throws Will throw an error if the total number of tickets is below 1 or exceeds the maximum allowed.
   */
  #checkTicketCount(ticketRequests) {
    const totalTickets = this.#calculateTotalTickets(ticketRequests);

    if (totalTickets <= 0) {
      throw new InvalidPurchaseException(messages.min_number_tickets_err);
    }

    if (totalTickets > ticketRules.MAX_TICKETS_PER_ORDER) {
      throw new InvalidPurchaseException(
        messages.max_allowed_tickets_err.replace('{allowedTickets}', ticketRules.MAX_TICKETS_PER_ORDER)
      );
    }
  }

  /**
   * Validates the ticket request to ensure it meets required rules.
   * @param {Object} ticketRequests - An object mapping ticket types to their requests.
   * @throws Will throw an error if the ticket combination is invalid, such as missing required ticket types.
   */
  #verifyTicketRules(ticketRequests) {
    const { ADULT, CHILD, INFANT } = ticketRequests;

    const adultCount = ADULT ?? 0;
    const childCount = CHILD ?? 0;
    const infantCount = INFANT ?? 0;

    // Validation: Child and Infant tickets cannot be purchased without at least one Adult ticket
    if (adultCount === 0 && (childCount > 0 || infantCount > 0)) {
      throw new InvalidPurchaseException(messages.error_adult_required);
    }

    //Validation: Infants will be sitting on an Adult's lap
    if (infantCount > adultCount) {
      throw new InvalidPurchaseException(messages.error_too_many_infants);
    }
  }

  /**
   * Validates the given ticket requests by checking total ticket count and adult requirements.
   * @param {Object} ticketRequests - An object mapping ticket types to their requests.
   */
  #verifyTicketOrder(ticketRequests) {
    this.#checkTicketCount(ticketRequests);
    this.#verifyTicketRules(ticketRequests);
  }

  /**
   * Should only have private methods other than the one below.
   */
  purchaseTickets(accountId, ...ticketTypeRequests) {
    const transactionId = this.snowflakeGenerator.generateId();
    logger.info(`Transaction ID: ${transactionId} - Account ID: ${accountId}`);

    // Validate input parameters
    this.#validatePurchaseRequest(accountId, ticketTypeRequests, transactionId);

    const ticketSummary = ticketTypeRequests.reduce((acc, request) => {
      const ticketType = request.getTicketType();
      acc[ticketType] = (acc[ticketType] || 0) + request.getNoOfTickets();
      return acc;
    }, {});
    logger.info(`Transaction ID: ${transactionId} - Ticket Summary: ${JSON.stringify(ticketSummary)}`);

    this.#verifyTicketOrder(ticketSummary);

    // ─── Seat Reservation Logic ────────────────────────────────────────────
    try {
      const totalSeats = this.#calculateTotalSeats(ticketTypeRequests);

      // Reserving seats first to ensure availability before proceeding with payment.
      // This prevents scenarios where users pay but later find out that the seat is unavailable.
      this.seatReservationService.reserveSeat(accountId, totalSeats);
      logger.info(`Transaction ID: ${transactionId} - ${messages.seat_reservation_successful} - Total Seats Reserved: ${totalSeats}`);
    } catch (seatError) {
      if (seatError instanceof TypeError) {
        logger.error(`Transaction ID: ${transactionId} - Seat Reservation Error: ${seatError.message}`);

        // Assumption: Standardizing the error format and also as third-party errors can sometimes be ambiguous
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

      logger.info(`Transaction ID: ${transactionId} - ${messages.payment_successful.replace('{totalCost}', totalCost)}`);

      // Returning a structured response
      return {
        message: messages.purchase_successful,
        transactionId: transactionId
      };
    } catch (paymentError) {
      if (paymentError instanceof TypeError) {
        logger.error(`Transaction ID: ${transactionId} - Payment Error: ${paymentError.message}`);
        throw new InvalidPurchaseException(messages.payment_error);
      }

      // This error might occur due to payment processing issues such as at payment gateway, bank
      // so logging with warn level.
      logger.warn(`Transaction ID: ${transactionId} - Payment Error: ${paymentError.message}`);

      // Assumption: For a valid request, payment processing is always expected to succeed. 
      // Therefore, retrying payments ... is not required.
      throw new InvalidPurchaseException(messages.payment_error);
    }
  }
}