'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function PlaceholderContent() {
  const params = useSearchParams();
  const router = useRouter();
  const title  = params.get('title') || 'Module';

  return (
    <div style={s.page}>
      <button onClick={() => router.back()} style={s.back}>← Back</button>
      <div style={s.body}>
        <div style={s.iconCircle}>
          <div style={s.gear} />
        </div>
        <h2 style={s.title}>Coming Soon</h2>
        <p style={s.sub}>{title} module is currently under development.</p>
        <p style={s.note}>Check back soon for updates.</p>
      </div>
    </div>
  );
}

export default function PlaceholderPage() {
  return (
    <Suspense fallback={null}>
      <PlaceholderContent />
    </Suspense>
  );
}

const s = {
  page: {
    padding:       '32px 36px',
    minHeight:     '80vh',
    display:       'flex',
    flexDirection: 'column',
  },
  back: {
    background:   'none',
    border:       'none',
    fontSize:     14,
    color:        '#8492A6',
    cursor:       'pointer',
    fontWeight:   600,
    marginBottom: 32,
    alignSelf:    'flex-start',
  },
  body: {
    flex:           1,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    textAlign:      'center',
  },
  iconCircle: {
    width:           100,
    height:          100,
    borderRadius:    50,
    backgroundColor: '#EEF1F7',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    24,
  },
  gear: {
    width:           40,
    height:          40,
    borderRadius:    '50%',
    border:          '4px solid #B0BAC9',
    backgroundColor: '#DDE3F0',
  },
  title: { fontSize: 26, fontWeight: 800, color: '#1A1A2E', marginBottom: 10 },
  sub:   { fontSize: 15, color: '#8492A6', marginBottom: 8, maxWidth: 320 },
  note:  { fontSize: 13, color: '#B0BAC9' },
};
