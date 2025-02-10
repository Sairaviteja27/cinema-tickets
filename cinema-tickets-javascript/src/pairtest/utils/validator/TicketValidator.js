import {ticketRules} from '../../config/TicketsConfig.js';
import messages from '../messages/messages.json' with { type: 'json' };
import InvalidPurchaseException from '../../lib/InvalidPurchaseException.js';

export default class TicketValidator {
  /**
   * Calculates the total number of tickets from all ticket requests.
   * @param {Object} ticketRequests - An object mapping ticket types to their requests.
   * @returns {number} The total count of tickets.
   */

  #calculateTotalTickets(ticketRequests) {
    return Object.values(ticketRequests).reduce((total, count) => total + (count ?? 0), 0);
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
  * Assumption: Children can go to movies alone for certain types of films and children can accompany infants
  */
  #verifyTicketRules(ticketRequests) {
    const { ADULT, CHILD, INFANT } = ticketRequests;

    const adultCount = ADULT ?? 0;
    const childCount = CHILD ?? 0;
    const infantCount = INFANT ?? 0;

    if (infantCount > 0 && adultCount === 0 && childCount === 0) {
      throw new InvalidPurchaseException(messages.error_infant_only_not_allowed);
    }

    // Validation: Infant count should not be more than the combined count of adults and children
    if (infantCount > (adultCount + childCount)) {
      throw new InvalidPurchaseException(messages.error_infant_exceeds_allowed);
    }

  }

  /**
   * Validates the given ticket requests by checking total ticket count and adult requirements.
   * @param {Object} ticketRequests - An object mapping ticket types to their requests.
   */
  verifyTicketOrder(ticketRequests) {
    this.#checkTicketCount(ticketRequests);
    this.#verifyTicketRules(ticketRequests);
  }
}