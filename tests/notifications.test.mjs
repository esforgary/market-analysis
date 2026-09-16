import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearNotificationHistory, emptyNotificationHistory, markNotificationsRead,
  readNotificationHistory, reconcileNotifications, MAX_NOTIFICATION_HISTORY,
} from '../lib/notification-history.ts';

const t1 = '2026-09-16T09:00:00.000Z';
const t2 = '2026-09-16T09:01:00.000Z';
const t3 = '2026-09-16T09:02:00.000Z';
const notice = { id: 'source-errors', message: '3 ленты временно не ответили.' };

test('an ongoing incident creates one toast and survives identical polling and reload', () => {
  const first = reconcileNotifications(emptyNotificationHistory(), [notice], t1);
  assert.equal(first.added.length, 1);
  assert.equal(first.history.entries.length, 1);
  const repeat = reconcileNotifications(first.history, [notice], t2);
  assert.equal(repeat.added.length, 0);
  assert.equal(repeat.history, first.history);
  const restored = readNotificationHistory(JSON.stringify(first.history));
  const afterReload = reconcileNotifications(restored, [notice], t3);
  assert.equal(afterReload.added.length, 0);
  assert.equal(afterReload.history.entries[0].createdAt, t1);
});

test('a changing failure count updates the same incident, with no new unread item', () => {
  const first = reconcileNotifications(emptyNotificationHistory(), [notice], t1).history;
  const read = markNotificationsRead(first);
  const updated = reconcileNotifications(read, [{...notice, message: '5 лент временно не ответили.'}], t2);
  assert.equal(updated.added.length, 0);
  assert.equal(updated.history.entries.length, 1);
  assert.equal(updated.history.entries[0].message, '5 лент временно не ответили.');
  assert.equal(updated.history.entries[0].read, true);
  assert.equal(updated.history.entries[0].createdAt, t1);
});

test('recovery resolves the existing entry and a later failure creates a fresh incident', () => {
  const first = reconcileNotifications(emptyNotificationHistory(), [notice], t1).history;
  const recovered = reconcileNotifications(first, [], t2);
  assert.equal(recovered.history.entries[0].resolvedAt, t2);
  assert.equal(recovered.history.active.length, 0);
  assert.equal(recovered.added.length, 0);
  const recurring = reconcileNotifications(recovered.history, [notice], t3);
  assert.equal(recurring.added.length, 1);
  assert.equal(recurring.history.entries.length, 2);
  assert.equal(recurring.history.entries[0].resolvedAt, undefined);
  assert.equal(recurring.history.entries[1].resolvedAt, t2);
  assert.notEqual(recurring.history.entries[0].eventId, recurring.history.entries[1].eventId);
});

test('clearing history does not make the same persistent warning reappear after reload', () => {
  const first = reconcileNotifications(emptyNotificationHistory(), [notice], t1).history;
  const cleared = clearNotificationHistory(first);
  const reloaded = readNotificationHistory(JSON.stringify(cleared));
  const repeat = reconcileNotifications(reloaded, [notice], t2);
  assert.equal(repeat.history.entries.length, 0);
  assert.equal(repeat.added.length, 0);
  const recovered = reconcileNotifications(repeat.history, [], t2).history;
  assert.equal(reconcileNotifications(recovered, [notice], t3).added.length, 1);
});

test('history is bounded while active incident markers prevent duplicate toasts for trimmed entries', () => {
  const notices = Array.from({length:70}, (_,index) => ({id:'feed-'+index, message:'Источник '+index+' недоступен.'}));
  const initial = reconcileNotifications(emptyNotificationHistory(), notices, t1);
  assert.equal(initial.history.entries.length, MAX_NOTIFICATION_HISTORY);
  assert.equal(initial.history.active.length, 70);
  const restored = readNotificationHistory(JSON.stringify(initial.history));
  assert.equal(reconcileNotifications(restored, notices, t2).added.length, 0);
});

test('invalid or duplicated input cannot break or duplicate the journal', () => {
  assert.deepEqual(readNotificationHistory('{broken'), emptyNotificationHistory());
  assert.deepEqual(readNotificationHistory(JSON.stringify({version:2,entries:[],active:[]})), emptyNotificationHistory());
  const first = reconcileNotifications(emptyNotificationHistory(), [notice, notice], t1);
  assert.equal(first.added.length, 1);
  const damaged = readNotificationHistory(JSON.stringify({...first.history, entries:[null, {bad:'record'}, ...first.history.entries]}));
  assert.equal(damaged.entries.length, 1);
  assert.equal(damaged.entries[0].message, notice.message);
});

