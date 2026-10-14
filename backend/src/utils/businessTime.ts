// Fuso do salão: America/Sao_Paulo (UTC-3, sem horário de verão).
// Horários de funcionamento ("HH:mm") são horários locais do salão;
// agendamentos e bloqueios são guardados como instantes (UTC) no banco.
const BUSINESS_UTC_OFFSET = "-03:00";
const BUSINESS_UTC_OFFSET_MINUTES = -180;
const MINUTE_IN_MS = 60 * 1000;
const DAY_IN_MS = 24 * 60 * MINUTE_IN_MS;

export const SLOT_STEP_MINUTES = 30;

export function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(totalMinutes: number): string {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// "2026-10-12" + "08:00" (horário do salão) -> instante correspondente
export function businessDateTime(date: string, time = "00:00"): Date {
  return new Date(`${date}T${time}:00${BUSINESS_UTC_OFFSET}`);
}

// Início do dia seguinte (limite exclusivo para consultas de um dia)
export function nextBusinessDay(date: string): Date {
  return new Date(businessDateTime(date).getTime() + DAY_IN_MS);
}

// 0 (domingo) a 6 (sábado) da data de calendário informada
export function businessDayOfWeek(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

// Instante -> data e minutos desde a meia-noite no horário do salão
export function toBusinessWallClock(instant: Date): {
  date: string;
  minutes: number;
} {
  const local = new Date(
    instant.getTime() + BUSINESS_UTC_OFFSET_MINUTES * MINUTE_IN_MS,
  );
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}
