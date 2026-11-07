// The event schedule the server pushes (mud_server scheduler.go): what is on now and what is
// next, as absolute times so the countdown runs on this device's clock.
export interface EventOnNow { title: string; ends: number }
export interface EventNext { title: string; at: number }
export interface Schedule { now: EventOnNow[]; next: EventNext[] }

// How long until a moment, in the loosest words that are still useful.
export function countdown(ms: number): string {
  if (ms < 60000) return 'under a minute';
  const minutes = Math.round(ms / 60000);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.round(ms / 3600000);
  if (hours < 48) return `${hours} h`;
  return `${Math.round(ms / 86400000)} days`;
}

// The visible part of a schedule at `now`: what has ended or already begun is dropped, since the
// server's frame for it may not have arrived yet.
export function current(s: Schedule, now: number): Schedule {
  return { now: s.now.filter((e) => e.ends > now), next: s.next.filter((e) => e.at > now) };
}

// The banner's one line, or null when there is nothing to say.
export function bannerText(s: Schedule | null, now: number): string | null {
  if (!s) return null;
  const c = current(s, now);
  if (c.now.length > 0) {
    const e = c.now[0];
    const more = c.now.length > 1 ? ` (+${c.now.length - 1} more)` : '';
    return `On now: ${e.title}, ends in ${countdown(e.ends - now)}${more}`;
  }
  if (c.next.length > 0) {
    const e = c.next[0];
    return `Next: ${e.title}, in ${countdown(e.at - now)}`;
  }
  return null;
}

// A start time in the player's own zone, with the con's Eastern time beside it when they differ.
export function startLabel(at: number): string {
  const fmt = (zone?: string) =>
    new Date(at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: zone });
  const local = fmt();
  const eastern = fmt('America/New_York');
  return local === eastern ? local + ' ET' : `${local} (${eastern} ET)`;
}
