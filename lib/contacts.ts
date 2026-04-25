// Simulates looking up people through the user's phone/bunq contacts.
// In a real app this would come from the bunq contacts API or device contacts.
export const DEMO_CONTACTS = [
  { name: "David", email: "test+e976b086-304e-4ad9-a0a2-64882380d152@bunq.com" },
  { name: "Ryan",  email: "ryan@example.com" },
  { name: "Alex",  email: "alex@example.com" },
] as const;

export function lookupContact(splitName: string): { name: string; email: string } | undefined {
  const lower = splitName.toLowerCase().trim();
  return DEMO_CONTACTS.find((c) => c.name.toLowerCase() === lower);
}
