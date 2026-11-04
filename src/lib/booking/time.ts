import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
export function parisInstant(date: string, time: string) {
  const instant = fromZonedTime(`${date}T${time}:00`, "Europe/Paris");
  if (
    formatInTimeZone(instant, "Europe/Paris", "yyyy-MM-dd HH:mm") !==
    `${date} ${time}`
  )
    throw new Error("Heure locale inexistante.");
  return instant.toISOString();
}
export function localDate(iso: string) {
  return formatInTimeZone(iso, "Europe/Paris", "dd/MM/yyyy HH:mm");
}
export function whatsappLink(number: string, service = "") {
  return /^\+[1-9]\d{7,14}$/.test(number)
    ? `https://wa.me/${number.slice(1)}?text=${encodeURIComponent(`Bonjour, je souhaite un renseignement${service ? ` sur ${service}` : ""}.`)}`
    : null;
}
