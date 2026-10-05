import React from 'react';
import { useDialogAccessibility } from '../../hooks/useDialogAccessibility';

interface Props {
  labelledBy: string;
  onClose?: () => void;
  className?: string;
  children: React.ReactNode;
}

/** Mount only while open. Omit onClose for a required, non-destructive onboarding choice. */
const Dialog: React.FC<Props> = ({ labelledBy, onClose, className = '', children }) => {
  const ref = useDialogAccessibility(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}
        className={`relative z-10 outline-none ${className}`}>
        {children}
      </div>
    </div>
  );
};

export default Dialog;
