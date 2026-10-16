'use client';
import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Every module opens on its Dashboard. This route only forwards old links and
// bookmarks there — the Overview tab it used to render is gone.
export default function ModuleIndex({ params: paramsPromise }) {
  // Next 15 hands route params over as a Promise — unwrap it once here.
  const params = use(paramsPromise);
  const router = useRouter();
  const slug = params.module;
  useEffect(() => { router.replace(`/m/${slug}/dashboard`); }, [slug, router]);
  return null;
}
