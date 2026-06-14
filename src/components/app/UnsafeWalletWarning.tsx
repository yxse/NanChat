import React, { useContext, useEffect, useState } from 'react';
import { getActiveSeedIndex, getSeeds } from '../../utils/storage';
import { Link } from 'react-router-dom';
import { LedgerContext } from '../LedgerContext';

export function UnsafeWalletWarning({step = 2}) {
  const [isSecure, setIsSecure] = useState<boolean | null>(() => {
    const flags: boolean[] = (() => {
      try { return JSON.parse(localStorage.getItem('walletSecureFlags') || '[]'); } catch { return []; }
    })();
    return flags.length > 0 ? !!flags[getActiveSeedIndex()] : null;
  });

  useEffect(() => {
    if (isSecure !== null) return;
    const idx = getActiveSeedIndex();
    getSeeds().then(seeds => {
      const derived = seeds.map(s => s.isSecureRandom ?? false);
      localStorage.setItem('walletSecureFlags', JSON.stringify(derived));
      setIsSecure(!!derived[idx]);
    });
  }, []);

  const {ledger} = useContext(LedgerContext);
  if (ledger) return null;
  if (isSecure === null) return null;
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
