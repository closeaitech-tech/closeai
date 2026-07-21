import React, { useEffect, useRef } from 'react';

export default function ModalWrapper({ children, onClose, title }) {
  const modalRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => { modalRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-3xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6 shadow-2xl backdrop-blur-xl outline-none">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)]">{title || 'OS AI'}</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
