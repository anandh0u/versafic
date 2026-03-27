// frontend/src/components/billing/CreditBalance.tsx
import { Wallet, TrendingDown } from 'lucide-react';

interface Props {
  balance: number;
  onBuyClick: () => void;
  loading?: boolean;
}

export function CreditBalance(props: Props) {
  const rupees = (props.balance / 10).toFixed(2);
  const displayBalance = props.balance.toLocaleString('en-IN');

  return (
    <div className="credit-balance-card">
      <div className="card-header">
        <Wallet className="icon" size={24} />
        <h2>Your Credits</h2>
      </div>

      <div className="balance-section">
        <div className="currency-display">
          <span className="rupee-symbol">₹</span>
          <span className="amount">{rupees}</span>
        </div>

        <div className="credit-display">
          <TrendingDown size={16} className="icon-small" />
          <span className="credit-count">{displayBalance} Credits</span>
        </div>
      </div>

      <div className="info-section">
        <p className="conversion-rate">
          <strong>1 Credit</strong> = ₹0.10 (1 Paise)
        </p>
        <p className="usage-hint">
          Credits are deducted for AI requests, calls, and transcriptions
        </p>
      </div>

      <button
        className="btn-primary btn-large"
        onClick={props.onBuyClick}
        disabled={props.loading}
      >
        {props.loading ? 'Loading...' : 'Buy Credits'}
      </button>

      <div className="status-bar">
        <div className="status-indicator"></div>
        <span className="status-text">Real-time balance • Auto-sync enabled</span>
      </div>

      <style>{`
        .credit-balance-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 28px;
          color: white;
          margin-bottom: 24px;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.2);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .card-header h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }

        .card-header .icon {
          opacity: 0.9;
        }

        .balance-section {
          margin-bottom: 24px;
        }

        .currency-display {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }

        .rupee-symbol {
          font-size: 32px;
          font-weight: 300;
          opacity: 0.9;
        }

        .amount {
          font-size: 48px;
          font-weight: 700;
          letter-spacing: -1px;
        }

        .credit-display {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          opacity: 0.95;
        }

        .credit-count {
          font-weight: 500;
        }

        .icon-small {
          opacity: 0.8;
        }

        .info-section {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          font-size: 14px;
        }

        .conversion-rate {
          margin: 0 0 8px 0;
          line-height: 1.4;
        }

        .usage-hint {
          margin: 0;
          opacity: 0.85;
          font-size: 13px;
        }

        .btn-primary {
          width: 100%;
          padding: 14px 20px;
          background: rgba(255, 255, 255, 0.25);
          border: 2px solid rgba(255, 255, 255, 0.4);
          color: white;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 12px;
        }

        .btn-primary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.35);
          border-color: rgba(255, 255, 255, 0.6);
          transform: translateY(-2px);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .status-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          opacity: 0.8;
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          background: #4ade80;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
