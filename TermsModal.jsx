import ModalWrapper from './ModalWrapper';

export default function TermsModal({ onClose }) {
  return (
    <ModalWrapper title="Terms of Service" onClose={onClose}>
      <div className="text-sm text-[var(--text-secondary)] space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        <p><strong>Effective Date:</strong> [Insert Date]</p>
        <p>Welcome to Capitan AI. By accessing or using our platform, you agree to be bound by these Terms of Service.</p>
        <p><strong>1. Eligibility</strong><br/>You must be at least 18 years old to use our services.</p>
        <p><strong>2. User Responsibilities</strong><br/>You are responsible for maintaining the security of your wallet and credentials. You agree not to misuse the AI services for illegal activities.</p>
        <p><strong>3. CLOSE Token</strong><br/>CLOSE tokens are utility tokens used within the Capitan AI ecosystem. They are not securities or investments. Purchase and staking of CLOSE are subject to network fees and volatility.</p>
        <p><strong>4. Limitation of Liability</strong><br/>Capitan AI is provided “as is.” We are not liable for any loss of funds, data, or profits arising from your use of the platform.</p>
        <p><strong>5. Changes</strong><br/>We may modify these terms at any time. Continued use constitutes acceptance.</p>
        <p>For full terms, please contact support.</p>
      </div>
      <button onClick={onClose} className="mt-4 w-full py-2 border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-sm font-semibold hover:bg-[var(--bg-tertiary)]">Close</button>
    </ModalWrapper>
  );
}