export type TicketTierProgress = {
  id: string;
  capacity: number | null;
  paidQuantity: number;
  active: boolean;
};

export function chooseActiveTicketTier(tiers: TicketTierProgress[]) {
  if (!tiers.length) return null;

  let activeIndex = tiers.findIndex((tier) => tier.active);
  if (activeIndex < 0) activeIndex = 0;

  while (
    activeIndex < tiers.length - 1 &&
    tiers[activeIndex].capacity !== null &&
    tiers[activeIndex].paidQuantity >= Number(tiers[activeIndex].capacity)
  ) {
    activeIndex += 1;
  }

  return tiers[activeIndex]?.id ?? null;
}

