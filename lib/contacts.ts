// Simulates looking up people through the user's phone/bunq contacts.
// In a real app this would come from the bunq contacts API or device contacts.
export const DEMO_CONTACTS = [
  { name: "David", phone: "+31614640803" },
  { name: "Ryan",  phone: "+31687654321" },
  { name: "Alex",  phone: "+31698765432" },
] as const;

export function lookupContact(splitName: string): { name: string; phone: string } | undefined {
  const lower = splitName.toLowerCase().trim();
  return DEMO_CONTACTS.find((c) => c.name.toLowerCase() === lower);
}
