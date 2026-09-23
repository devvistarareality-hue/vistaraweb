'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Every module opens on its Dashboard. This route only forwards old links and
// bookmarks there — the Overview tab it used to render is gone.
export default function ModuleIndex({ params }) {
  const router = useRouter();
  const slug = params.module;
  useEffect(() => { router.replace(`/m/${slug}/dashboard`); }, [slug, router]);
  return null;
}
