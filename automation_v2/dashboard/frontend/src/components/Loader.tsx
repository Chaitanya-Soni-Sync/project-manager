export function Loader() {
  return (
    <div className="loader-grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="skeleton-bar" style={{ width: '30%', height: '10px' }} />
          <div className="skeleton-bar" style={{ width: '70%', height: '20px', marginTop: '1rem' }} />
          <div className="skeleton-bar" style={{ width: '50%', height: '14px', marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '6px', marginTop: '1rem' }}>
            <div className="skeleton-bar" style={{ width: '60px', height: '22px', borderRadius: '99px' }} />
            <div className="skeleton-bar" style={{ width: '60px', height: '22px', borderRadius: '99px' }} />
          </div>
          <div className="skeleton-bar" style={{ width: '40%', height: '12px', marginTop: '1.5rem' }} />
        </div>
      ))}
    </div>
  );
}

export function DetailLoader() {
  return (
    <div className="detail-loader" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="skeleton-bar" style={{ width: '180px', height: '14px', marginBottom: '1.5rem' }} />
      <div className="skeleton-bar" style={{ width: '300px', height: '32px', marginBottom: '0.5rem' }} />
      <div className="skeleton-bar" style={{ width: '200px', height: '14px', marginBottom: '2rem' }} />
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-card" style={{ flex: 1, height: '90px', animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="skeleton-bar" style={{ width: '100%', height: '200px', borderRadius: '12px' }} />
    </div>
  );
}
