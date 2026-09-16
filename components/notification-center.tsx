"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Bell, Check, CheckCheck, CircleAlert, Clock3, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  clearNotificationHistory, emptyNotificationHistory, markNotificationsRead, NOTIFICATION_HISTORY_KEY,
  readNotificationHistory, reconcileNotifications, type Notice, type NotificationHistory,
} from '@/lib/notification-history';
import './notification-center.css';

export type NotificationCenterProps = {
  notices: Notice[];
  onOpenSources: () => void;
  /** False until the first check completes: an initial empty array does not mean recovery. */
  ready?: boolean;
};
function formatTime(value: string) {
  return new Date(value).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export default function NotificationCenter({ notices, onOpenSources, ready = true }: NotificationCenterProps) {
  const [history, setHistory] = useState<NotificationHistory>(emptyNotificationHistory);
  const historyRef = useRef(history);
  const hydrated = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [queue, setQueue] = useState<string[][]>([]);
  const [toastClosing, setToastClosing] = useState(false);
  const [toastPaused, setToastPaused] = useState(false);
  const noticeKey = JSON.stringify(notices.map(({id, message}) => ({id, message})).sort((a, b) => a.id.localeCompare(b.id)));
  const commit = useCallback((next: NotificationHistory) => {
    historyRef.current = next;
    setHistory(next);
    try { localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(next)); } catch { /* The in-memory journal still works when storage is unavailable. */ }
  }, []);
  useEffect(() => {
    if (!hydrated.current) {
      setMounted(true);
      let restored = emptyNotificationHistory();
      try { restored = readNotificationHistory(localStorage.getItem(NOTIFICATION_HISTORY_KEY)); } catch {}
      historyRef.current = restored;
      setHistory(restored);
      hydrated.current = true;
    }
    if (!ready) return;
    const { history: next, added } = reconcileNotifications(historyRef.current, JSON.parse(noticeKey));
    if (next !== historyRef.current) commit(openRef.current ? markNotificationsRead(next) : next);
    if (added.length && !openRef.current) setQueue(previous => [...previous, added.map(entry => entry.eventId)]);
  }, [noticeKey, ready, commit]);

  const toastIds = queue[0];
  const toastKey = toastIds?.join('|');
  useEffect(() => {
    if (!toastKey || toastClosing || toastPaused) return;
    const timeout = setTimeout(() => setToastClosing(true), 5500);
    return () => clearTimeout(timeout);
  }, [toastKey, toastClosing, toastPaused]);
  useEffect(() => {
    if (!toastClosing) return;
    const timeout = setTimeout(() => {
      setQueue(previous => previous.slice(1));
      setToastClosing(false);
      setToastPaused(false);
    }, 270);
    return () => clearTimeout(timeout);
  }, [toastClosing]);

  function changeOpen(next: boolean) {
    openRef.current = next;
    setOpen(next);
    if (next) {
      commit(markNotificationsRead(historyRef.current));
      if (queue.length) {
        setQueue(previous => previous.slice(0, 1));
        setToastClosing(true);
      }
    }
  }
  function openSources() {
    changeOpen(false);
    setToastClosing(true);
    onOpenSources();
  }
  const unread = history.entries.filter(entry => !entry.read).length;
  const activeCount = history.entries.filter(entry => !entry.resolvedAt).length;
  const toastEntries = toastIds?.map(id => history.entries.find(entry => entry.eventId === id)).filter(Boolean) || [];
  const toastEntry = toastEntries[0];

  return <>
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button type="button" className="notification-bell icon-btn" aria-label={unread ? 'Уведомления: ' + unread + ' непрочитанных' : 'Уведомления'} title="Уведомления" data-unread={unread > 0}>
          <Bell size={18} aria-hidden="true" />
          {unread > 0 && <span className="notification-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </DialogTrigger>
      <DialogContent className="notification-dialog">
        <DialogHeader className="notification-heading">
          <span className="notification-heading-icon"><Bell size={20} aria-hidden="true" /></span>
          <DialogTitle>Уведомления</DialogTitle>
          <DialogDescription>Состояние данных и источников. Последние 50 событий сохраняются на этом устройстве.</DialogDescription>
        </DialogHeader>
        <div className="notification-toolbar">
          <span>{history.entries.length ? activeCount ? activeCount + ' активных' : 'Все события устранены' : 'Журнал событий'}</span>
          <button type="button" onClick={() => commit(clearNotificationHistory(historyRef.current))} disabled={!history.entries.length}>
            <Trash2 size={14} aria-hidden="true" /> Очистить
          </button>
        </div>
        {history.entries.length ? <ol className="notification-history" aria-label="История состояния данных">
          {history.entries.map(entry => <li className="notification-entry" key={entry.eventId} data-resolved={!!entry.resolvedAt}>
            <span className="notification-entry-icon">{entry.resolvedAt ? <Check size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}</span>
            <div className="notification-entry-body">
              <div className="notification-entry-meta">
                <span className="notification-entry-status">{entry.resolvedAt ? 'Устранено' : 'Активно'}</span>
                <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString('ru-RU')}>{formatTime(entry.createdAt)}</time>
              </div>
              <p>{entry.message}</p>
              {entry.resolvedAt && <span className="notification-recovery"><CheckCheck size={12} aria-hidden="true" /> Восстановлено {formatTime(entry.resolvedAt)}</span>}
            </div>
          </li>)}
        </ol> : <div className="notification-empty">
          <span><Bell size={26} strokeWidth={1.4} aria-hidden="true" /></span>
          <strong>Журнал пуст</strong>
          <p>Новые сообщения о данных появятся здесь. Можно продолжать обзор рынка.</p>
        </div>}
        <footer className="notification-footer">
          <span><Clock3 size={13} aria-hidden="true" /> Повторные проверки не дублируются</span>
          <button type="button" onClick={openSources}>Открыть источники <ArrowUpRight size={14} aria-hidden="true" /></button>
        </footer>
      </DialogContent>
    </Dialog>
    {mounted && toastEntry && createPortal(<aside className="notification-toast" data-state={toastClosing ? 'closing' : 'open'}
      onMouseEnter={() => setToastPaused(true)} onMouseLeave={() => setToastPaused(false)}
      onFocusCapture={() => setToastPaused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setToastPaused(false); }}>
      <span className="notification-toast-icon"><CircleAlert size={18} aria-hidden="true" /></span>
      <div className="notification-toast-body">
        <strong>Состояние данных</strong>
        <p role="status" aria-live="polite" aria-atomic="true">{toastEntry.message}{toastEntries.length > 1 && <span className="notification-toast-more">И ещё {toastEntries.length - 1} в журнале.</span>}</p>
        <button type="button" onClick={() => changeOpen(true)}>Посмотреть уведомления <ArrowUpRight size={13} aria-hidden="true" /></button>
      </div>
      <button type="button" className="notification-toast-close" aria-label="Скрыть уведомление" onClick={() => setToastClosing(true)}><X size={15} aria-hidden="true" /></button>
    </aside>, document.body)}
  </>;
}


