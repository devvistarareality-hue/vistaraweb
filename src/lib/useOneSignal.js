'use client';
import { useEffect } from 'react';

const ONESIGNAL_APP_ID = '6904b4e0-0e22-4685-a609-a38038a4082a';

let initialized = false;

export function useOneSignal(userCode) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function init() {
      const OneSignal = (await import('react-onesignal')).default;
      if (!initialized) {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
        initialized = true;
      }
      if (userCode) {
        await OneSignal.login(userCode);
      }
    }

    init().catch(() => {});
  }, [userCode]);
}
