import React from 'react';

const BlueprintLoader = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        width: '100%',
        padding: '3rem 1.5rem',
        position: 'relative',
        zIndex: 20
      }}
      aria-label="Loading Architectural Blueprint"
    >
      {/* Precision CAD Rotating Crosshair Spinner */}
      <div style={{ position: 'relative', width: '70px', height: '70px', marginBottom: '1.5rem' }}>
        {/* Outer Ring */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px dashed rgba(250, 232, 164, 0.35)',
            animation: 'spin 8s linear infinite'
          }}
        />
        {/* Inner Glowing Arc */}
        <div
          style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'var(--accent-orange)',
            borderRightColor: 'var(--accent-gold)',
            boxShadow: '0 0 15px rgba(250, 232, 164, 0.4)',
            animation: 'spin 1.2s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite'
          }}
        />
        {/* Center Crosshair Dot */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: '6px',
            height: '6px',
            background: 'var(--accent-gold)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 10px var(--accent-gold)'
          }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p
          className="calligraphy-kicker"
          style={{
            color: 'var(--accent-gold)',
            letterSpacing: '0.22em',
            fontSize: '0.82rem',
            marginBottom: '0.4rem',
            textTransform: 'uppercase'
          }}
        >
          1:1 Scale Calibration
        </p>
        <h4
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.1rem',
            color: '#ffffff',
            letterSpacing: '0.04em',
            margin: 0
          }}
        >
          Rendering Architectural Space...
        </h4>
      </div>
    </div>
  );
};

export default BlueprintLoader;
