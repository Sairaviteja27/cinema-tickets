const ticketCategories = Object.freeze({
  INFANT: "INFANT",
  CHILD: "CHILD",
  ADULT: "ADULT",
});

const ticketRules = Object.freeze({
  MAX_TICKETS_PER_ORDER: 25,
});

const ticketCost = Object.freeze({
  [ticketCategories.INFANT]: 0,
  [ticketCategories.CHILD]: 15,
  [ticketCategories.ADULT]: 25,
});

export { ticketCategories, ticketRules, ticketCost };
