import React, { useMemo } from 'react';
import { getActiveSeedIndex } from '../../utils/storage';
import { Link } from 'react-router-dom';

export function UnsafeWalletWarning({step = 2}) {
  const isSecure = useMemo(() => {
    const flags: boolean[] = JSON.parse(localStorage.getItem('walletSecureFlags') || '[]');
    return !!flags[getActiveSeedIndex()];
  }, []);

  if (isSecure && step === 2) return <div className="text-center" style={{ color: 'var(--adm-color-text-secondary)', marginTop: 32 }}>
              Use Change Secret Phrase to migrate your funds, chats, and settings to a new wallet. <br/><br/>
              
            </div>;
  if (isSecure) return null;
  return (
    <div>

      {
        step == 1 ?
    <div className="p-3 text-center" style={{ color: 'var(--adm-color-warning)' }}>
      You are using an unsafe secret phrase. Migration is highly recommended for the safety of your funds and chats.{' '}
      <Link to={"/settings/change-secret-phrase"} className="underline">
        Migrate now
      </Link>
    </div>
      :
      <div className="p-3 text-center" style={{ color: 'var(--adm-color-warning)' }}>
      Your wallet was created with a version of NanChat (prior to v1.3.0) affected by a Secret Phrase vulnerability. Please generate a new secret phrase and migrate to protect your funds and chats.{' '}
      <a href="https://nanchat.com/security" target="_blank" rel="noopener noreferrer" className="underline">
        Read more
      </a>
      </div>
      }
    </div>
  );
}
