import { createContext, useContext } from 'react';

export type NotifType = 'success' | 'info' | 'warning' | 'error';

export interface NotifItem {
  id: number;
  type: NotifType;
  message: string;
}

export interface NotificationApi {
  /** Tampilkan notifikasi. `error` tidak hilang sendiri — operator harus menutupnya. */
  add: (message: string, type?: NotifType) => void;
  dismiss: (id: number) => void;
}

/**
 * Berada di file terpisah dari provider-nya: satu file hanya mengekspor komponen
 * supaya Fast Refresh tetap bekerja (aturan `react(only-export-components)`).
 */
export const NotificationCtx = createContext<NotificationApi | null>(null);

/**
 * Tanpa provider (mis. di luar `<NotificationProvider>`), pesan hanya dicatat —
 * sengaja tidak jatuh ke `window.alert` supaya pola lama tidak diam-diam kembali.
 */
export const useNotification = (): NotificationApi => {
  const ctx = useContext(NotificationCtx);
  return ctx || { add: (m: string, t: NotifType = 'info') => console.warn(`[notifikasi ${t}] ${m}`), dismiss: () => {} };
};
