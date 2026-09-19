import { ImageResponse } from 'next/og';

export const alt = 'Mirai — Live2D AI Companion';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The social preview card, rendered on demand.
 *
 * Generated rather than checked in as a PNG so it never drifts from the
 * product: change the tagline in one place and every link preview follows.
 * No custom fonts are loaded — a webfont fetch here is a build-time network
 * dependency, and the system stack renders this layout perfectly well.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          // Tracks the app's lifted palette — the card and the page it links
          // to should not look like two different products.
          background:
            'radial-gradient(1000px 600px at 12% 0%, #5b34a6 0%, transparent 60%), radial-gradient(900px 600px at 100% 100%, #1d7d97 0%, transparent 58%), #231f35',
          color: '#f4f2fb',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'rgba(167,139,250,0.3)',
              border: '1px solid rgba(232,121,249,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                background: '#a78bfa',
              }}
            />
          </div>
          <div style={{ fontSize: 34, letterSpacing: -0.5, opacity: 0.85 }}>
            Mirai
          </div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 82,
            lineHeight: 1.05,
            letterSpacing: -2.5,
            fontWeight: 700,
            maxWidth: 900,
          }}
        >
          A Live2D AI companion that actually reacts.
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.4,
            color: 'rgba(244,242,251,0.6)',
            maxWidth: 860,
          }}
        >
          Streaming replies, amplitude-driven lip sync, and expressions the
          model chooses mid-sentence.
        </div>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            gap: 12,
            fontSize: 22,
            color: 'rgba(244,242,251,0.45)',
          }}
        >
          {['Next.js', 'AI SDK', 'PixiJS', 'Cubism 4'].map((chip) => (
            <div
              key={chip}
              style={{
                padding: '8px 18px',
                borderRadius: 999,
                border: '1px solid rgba(244,242,251,0.16)',
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
