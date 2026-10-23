// Reporting exclusions requested 23 October 2026. These IDs stay hidden even if
// renamed/reactivated; current and newly created campaigns remain eligible.
// This changes admin reporting only, never Meta delivery or campaign status.
export const hiddenMetaCampaignIds=new Set([
 '120255654427230428', // Blackley’s Bucket | Website visits
 '120255652935720428', // Fancy a set on NYE?
 '120255632797060428', // Tickets available this Friday
 '120255565688880428', // BLACKLEY. MIDNIGHT. NEW YEAR’S EVE.
 '120255529352320428', // The secret’s out
 '120255462258940428', // Something big is landing
 '120255232810050428', // New post engagement campaign
 '120254460836320428', // Wrapping up summer 2026
 '120254444014500428'  // Summer Round Up event
]);
export const visibleMetaCampaigns=campaigns=>campaigns.filter(c=>!hiddenMetaCampaignIds.has(String(c.id)));
