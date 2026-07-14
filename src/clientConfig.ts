// Client/tenant identity — a downstream fork swaps ONLY this file + poData.ts.
export const BUYER = {
  companyName:    'Debenhams',
  buyingTeam:     'Debenhams Buying Team',   // used in email closings "Kind regards,\n<buyingTeam>" etc.
  buyingTeamShort:'Debenhams Buying',        // used in "Best regards,\n<buyingTeamShort>"
}
export const EDIT_USER = 'Emma (Merchandiser)'

// Entity vocabulary — the axis this tenant monitors and groups by. A retailer
// monitors its SUPPLIERS; a freight-forwarder tenant monitors the CUSTOMERS it
// ships to (same detection engine, different word). A fork flips perspective by
// changing ONLY this block — see the Ligentia fork, which sets these to Customer.
export const ENTITY = {
  singular:    'Supplier',
  plural:      'Suppliers',
  lower:       'supplier',
  healthTitle: 'Supplier Health',
  groupByLabel:'By supplier',
}
export const TEAM = {
  merchandiser: 'Emma (Merchandiser)',
  // managers/reviewers referenced in App.tsx logic:
  manager1: 'Sarah Chen',
  manager2: 'James Wright',
  manager3: 'Priya Sharma',
}
