export type Notice = { id: string; message: string };
export type NotificationEntry = {
  eventId: string;
  noticeId: string;
  message: string;
  createdAt: string;
  resolvedAt?: string;
  read: boolean;
};
export type NotificationHistory = {
  version: 1;
  serial: number;
  entries: NotificationEntry[];
  active: { id: string; eventId: string }[];
};
export const NOTIFICATION_HISTORY_KEY = 'meridian.notifications.v1';
export const MAX_NOTIFICATION_HISTORY = 50;
export function emptyNotificationHistory(): NotificationHistory {
  return { version: 1, serial: 0, entries: [], active: [] };
}
function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
function validText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}
/** Read only our versioned, bounded record. A damaged local cache must not break the app. */
export function readNotificationHistory(serialized: string | null): NotificationHistory {
  if (!serialized) return emptyNotificationHistory();
  try {
    const value = JSON.parse(serialized);
    if (!value || value.version !== 1 || !Array.isArray(value.entries) || !Array.isArray(value.active)) return emptyNotificationHistory();
    const entries: NotificationEntry[] = value.entries.filter((item: NotificationEntry) => item &&
      validText(item.eventId, 250) && validText(item.noticeId, 120) && validText(item.message, 3000) &&
      validDate(item.createdAt) && (item.resolvedAt === undefined || validDate(item.resolvedAt)) && typeof item.read === 'boolean'
    ).slice(0, MAX_NOTIFICATION_HISTORY);
    const active = value.active.filter((item: {id: string; eventId: string}) => item &&
      validText(item.id, 120) && validText(item.eventId, 250)
    ).slice(0, 100);
    return {
      version: 1,
      serial: Number.isSafeInteger(value.serial) && value.serial >= 0 ? value.serial : entries.length,
      entries: [...new Map(entries.map(entry => [entry.eventId, entry])).values()],
      active: [...new Map<string, {id: string; eventId: string}>(active.map((item: {id: string; eventId: string}) => [item.id, item])).values()],
    };
  } catch { return emptyNotificationHistory(); }
}
/** Stable notice IDs identify ongoing incidents; changing a count updates the same incident. */
export function reconcileNotifications(previous: NotificationHistory, notices: Notice[], now = new Date().toISOString()) {
  const current = new Map(notices.filter(notice => notice && validText(notice.id, 120) && validText(notice.message, 3000))
    .slice(0, 100).map(notice => [notice.id, notice]));
  const active = new Map(previous.active.map(item => [item.id, item.eventId]));
  let entries = previous.entries;
  let serial = previous.serial;
  let changed = false;
  const added: NotificationEntry[] = [];
  for (const [id, eventId] of active) {
    if (current.has(id)) continue;
    active.delete(id);
    entries = entries.map(entry => entry.eventId === eventId && !entry.resolvedAt ? { ...entry, resolvedAt: now } : entry);
    changed = true;
  }
  for (const [id, notice] of current) {
    const existingId = active.get(id);
    if (existingId) {
      const existing = entries.find(entry => entry.eventId === existingId);
      if (existing && existing.message !== notice.message) {
        entries = entries.map(entry => entry.eventId === existingId ? { ...entry, message: notice.message } : entry);
        changed = true;
      }
      continue;
    }
    serial += 1;
    const entry: NotificationEntry = { eventId: now + ':' + serial, noticeId: id, message: notice.message, createdAt: now, read: false };
    active.set(id, entry.eventId);
    added.push(entry);
    changed = true;
  }
  if (!changed) return { history: previous, added };
  entries = [...added.reverse(), ...entries].slice(0, MAX_NOTIFICATION_HISTORY);
  return { history: { version: 1 as const, serial, entries, active: [...active].map(([id, eventId]) => ({ id, eventId })) }, added };
}
export function markNotificationsRead(history: NotificationHistory): NotificationHistory {
  if (history.entries.every(entry => entry.read)) return history;
  return { ...history, entries: history.entries.map(entry => entry.read ? entry : { ...entry, read: true }) };
}
/** Preserve active incident IDs after clearing, so polling/reloading cannot resurrect dismissed warnings. */
export function clearNotificationHistory(history: NotificationHistory): NotificationHistory {
  return history.entries.length ? { ...history, entries: [] } : history;
}

