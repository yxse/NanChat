import React, { useContext, useEffect, useState } from 'react';
import { getActiveSeedIndex, getSeeds } from '../../utils/storage';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { LedgerContext } from '../LedgerContext';
import { useTranslation } from 'react-i18next';

export const CHANGE_SECRET_PHRASE_PATH = '/settings/change-secret-phrase';

// Secure flags for each stored seed (null while loading)
function useWalletSecureFlags(): boolean[] | null {
  const [flags, setFlags] = useState<boolean[] | null>(() => {
    const cached: boolean[] = (() => {
      try { return JSON.parse(localStorage.getItem('walletSecureFlags') || '[]'); } catch { return []; }
    })();
    return cached.length > 0 ? cached : null;
  });

  useEffect(() => {
    if (flags !== null) return;
    getSeeds().then(seeds => {
      const derived = seeds.map(s => s.isSecureRandom ?? false);
      localStorage.setItem('walletSecureFlags', JSON.stringify(derived));
      setFlags(derived);
    });
  }, []);

  return flags;
}

// Seeds generated before v1.3.0 are compromised: migration is mandatory when no secure wallet exists.
// If a secure wallet exists (already migrated), the user may still switch to the old one to sweep leftover funds.
export function useMustMigrate(): boolean {
  const flags = useWalletSecureFlags();
  const { ledger } = useContext(LedgerContext);
  if (ledger || !flags || flags.length === 0) return false;
  return !flags.some(Boolean);
}

export function ForceMigrationGuard() {
  const mustMigrate = useMustMigrate();
  const location = useLocation();
  if (mustMigrate && location.pathname !== CHANGE_SECRET_PHRASE_PATH) {
    return <Navigate to={CHANGE_SECRET_PHRASE_PATH} replace />;
  }
  return null;
}

export function UnsafeWalletWarning({step = 2}) {
  const { t } = useTranslation();
  const flags = useWalletSecureFlags();
  const isSecure = flags === null ? null : !!flags[getActiveSeedIndex()];

  const {ledger} = useContext(LedgerContext);
  if (ledger) return null;
  if (isSecure === null) return null;
  if (isSecure && step === 2) return <div className="text-center" style={{ color: 'var(--adm-color-text-secondary)', marginTop: 32 }}>
              {t('changeSecretPhraseInfo')} <br/><br/> {t('changeSecretPhraseAddressesChange')} <br/><br/> {t('changeSecretPhraseIrreversible')} <br/><br/>
            </div>;
  if (isSecure) return null;
  return (
    <div>

      {
        step == 1 ?
    <div className="p-3 text-center" style={{ color: 'var(--adm-color-warning)' }}>
      {t('compromisedWalletBanner')}{' '}
      <Link to={"/me/settings"} className="underline">
        {t('switchWallet')}
      </Link>
    </div>
      :
      <div className="p-3 text-center" style={{ color: 'var(--adm-color-warning)' }}>
      {t('unsafeWalletVulnerability')}{' '}
      <a href="https://nanchat.com/security" target="_blank" rel="noopener noreferrer" className="underline">
        {t('readMore')}
      </a>
      </div>
      }
    </div>
  );
}
