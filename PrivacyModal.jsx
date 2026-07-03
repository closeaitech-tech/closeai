import ModalWrapper from './ModalWrapper';

export default function PrivacyModal({ onClose }) {
  return (
    <ModalWrapper title="Privacy Policy" onClose={onClose}>
      <div className="text-sm text-[var(--text-secondary)] space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        <p><strong>Effective Date:</strong> [Insert Date]</p>
        <p>Your privacy is important to us. This policy explains how we collect, use, and protect your personal data.</p>
        <p><strong>1. Information We Collect</strong><br/>We collect your email address, name, and wallet address when you register. We do not store your private keys or passwords.</p>
        <p><strong>2. How We Use Information</strong><br/>We use your data to provide AI chat services, process transactions, and improve our platform.</p>
        <p><strong>3. Data Sharing</strong><br/>We do not sell your personal data. We may share anonymized usage data with third-party analytics services.</p>
        <p><strong>4. Security</strong><br/>We implement industry-standard security measures, but no method of transmission over the Internet is 100% secure.</p>
        <p><strong>5. Your Rights</strong><br/>You can request deletion of your data by contacting support.</p>
        <p>For more details, please contact our privacy team.</p>
      </div>
      <button onClick={onClose} className="mt-4 w-full py-2 border border-[var(--glass-border)] text-[var(--text-primary)] rounded-xl text-sm font-semibold hover:bg-[var(--bg-tertiary)]">Close</button>
    </ModalWrapper>
  );
}