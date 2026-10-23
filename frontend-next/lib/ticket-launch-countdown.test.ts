import { describe, expect, it } from 'vitest';
import { ticketLaunchRemaining, TICKET_LAUNCH_AT } from './ticket-launch-countdown';
describe('ticket launch countdown', () => {
  it('targets Friday at midday British Summer Time', () => {
    expect(new Date(TICKET_LAUNCH_AT).toISOString()).toBe('2026-10-23T11:00:00.000Z');
    expect(ticketLaunchRemaining(Date.parse('2026-10-22T11:00:00Z'))).toEqual([1,0,0,0]);
    expect(ticketLaunchRemaining(Date.parse('2026-10-23T07:00:00Z'))).toEqual([0,4,0,0]);
  });
  it('clamps at zero after launch', () => {
    expect(ticketLaunchRemaining(TICKET_LAUNCH_AT + 1000)).toEqual([0,0,0,0]);
    expect(ticketLaunchRemaining(TICKET_LAUNCH_AT - 1000)).toEqual([0,0,0,1]);
  });
});
