import type { Service } from "@/lib/catalogue";
import copy from "@/config/service-copy.json" with { type: "json" };

// Replace only legacy seed copy. Owner-written descriptions remain authoritative.
const legacyDescriptions: Record<string, string> = copy.descriptions;
export function serviceDescription(service: Pick<Service, "description">) {
  return legacyDescriptions[service.description] ?? service.description;
}
export function categoryLabel(category: string) {
  return (copy.categories as Record<string, string>)[category] ?? category;
}
