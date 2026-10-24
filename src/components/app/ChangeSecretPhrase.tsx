import React, { useState, useContext, useRef, useEffect } from 'react';
import { NavBar, Button, Toast, DotLoading, List } from 'antd-mobile';
import { wallet as walletLib } from 'multi-nano-web';
import { useNavigate } from 'react-router-dom';
import { ExclamationTriangleOutline, CheckCircleOutline, FingerdownOutline, DownlandOutline } from 'antd-mobile-icons';
import { AiFillAndroid, AiFillApple } from 'react-icons/ai';
import { MnemonicWords } from '../Initialize/create/Mnemonic';
import { MnemonicInput } from '../Initialize/restore/MnemonicInput';
import { WalletContext } from '../useWallet';
import { PinAuthPopup } from '../Lock/PinLock';
import { generateSecureSeed, prependWalletSeed } from '../../utils/storage';
import { UnsafeWalletWarning, useMustMigrate } from './UnsafeWalletWarning';
import { addSharedKeyForParticipants } from '../../services/sharedkey';
import { box } from 'multi-nano-web';
import { addParticipants, fetcherMessages, getNewChatToken, saveMessageCache, signMessage } from '../messaging/fetcher';
import { ResponsivePopup } from '../Settings';
import { useHideNavbarOnMobile } from '../../hooks/use-hide-navbar';
import { PasswordForm } from '../Initialize/create/Password';
import { encrypt } from '../../worker/crypto';
import { saveAs } from 'file-saver';
import { Capacitor } from '@capacitor/core';
import { backupWalletGoogleDrive, backupWalletICloud } from '../../services/capacitor-chunked-file-writer';
import { convertAddress } from '../../utils/convertAddress';
import { rawToMega } from '../../nano/accounts';
import { formatAmountMega, formatAmountRaw } from '../../utils/format';
import { useTranslation } from 'react-i18next';

type Step = 'intro' | 'backup' | 'confirm' | 'migrating' | 'done';

interface TransferPreview {
  ticker: string;
  fromAddr: string;
  toAddr: string;
  balance: string;
  index: number;
}


function getTimestampFilename() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
}

function NewSeedCloudBackup({ seed, onDone }: { seed: string; onDone: () => void }) {
  const { t } = useTranslation();
  let textSave = t('downloadEncryptedFile');
  if (Capacitor.getPlatform() === 'ios') textSave = t('saveToICloud');
  else if (Capacitor.getPlatform() === 'android') textSave = t('saveToGoogleDrive');

  return (
    <div className="p-4">
      <div className="text-2xl text-center mb-2">{t('createPassword')}</div>
      <div className="p-2 mb-2 text-center text-sm" style={{ color: 'var(--adm-color-warning)' }}>
        {t('doNotLoseYourPasswordOrYourBackupWillBeUnrecoverable')}
      </div>
      <PasswordForm
        onFinish={async (values) => {
          try {
            const encryptedSeed = await encrypt(seed, values.password);
            const fileName = `nanchat-new-wallet-${getTimestampFilename()}.txt`;
            Toast.show({ icon: 'loading', duration: 0 });
            let success = false;
            if (Capacitor.getPlatform() === 'ios') {
              const uri = await backupWalletICloud(encryptedSeed, fileName);
              if (uri) success = true;
            } else if (Capacitor.getPlatform() === 'android') {
              await backupWalletGoogleDrive(encryptedSeed, fileName);
              success = true;
            } else {
              const blob = new Blob([encryptedSeed], { type: 'text/plain;charset=utf-8' });
              saveAs(blob, fileName);
              success = true;
            }
            if (success) {
              Toast.clear();
              onDone();
            } else {
              Toast.show({ icon: 'fail', content: t('backupFailed') });
            }
          } catch (e) {
            Toast.show({ icon: 'fail', content: t('backupFailedWithError', { error: String(e) }) });
          }
        }}
        buttonText={textSave}
      />
    </div>
  );
}

function NewSeedManualBackup({
  visible,
  mnemonic,
  onClose,
  onDone,
}: {
  visible: boolean;
  mnemonic: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [verifyVisible, setVerifyVisible] = useState(false);

  return (
    <>
      <ResponsivePopup
        visible={visible}
        onClose={onClose}
        closeOnMaskClick
        showCloseButton
        destroyOnClose
        bodyStyle={{ maxHeight: '100dvh', overflowY: 'auto' }}
      >
        <div className="p-4">
          <div className="text-2xl text-center mb-2">{t('writeDownYourPhrase')}</div>
          <div className="text-sm text-center mb-4" style={{ color: 'var(--adm-color-warning)' }}>
            {t('neverShareSecretPhraseOffline')}
          </div>
          <MnemonicWords mnemonic={mnemonic} defaultIsRevealed={false} showHideButton colorCopy="default" />
          <Button
            color="primary"
            size="large"
            shape="rounded"
            className="w-full mt-4"
            onClick={() => setVerifyVisible(true)}
          >
            {t('verifySecretPhrase')}
          </Button>
        </div>
      </ResponsivePopup>
      <ResponsivePopup
        visible={verifyVisible}
        onClose={() => setVerifyVisible(false)}
        closeOnMaskClick
        showCloseButton
        destroyOnClose
        bodyStyle={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        <div className="p-4">
          <div className="text-xl font-semibold text-center mb-4">{t('verifyRecoveryPhrase')}</div>
          <MnemonicInput
            mode="verify"
            onImport={(words) => {
              if (words.join(' ') === mnemonic) {
                setVerifyVisible(false);
                onClose();
                onDone();
              } else {
                Toast.show({ icon: 'fail', content: t('incorrectWordsCheckBackup') });
              }
            }}
          />
        </div>
      </ResponsivePopup>
    </>
  );
}

export default function ChangeSecretPhrase() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { wallet } = useContext(WalletContext);
  useHideNavbarOnMobile(true);
  const mustMigrate = useMustMigrate();

  const [step, setStep] = useState<Step>('intro');
  const [pinVisible, setPinVisible] = useState(false);
  const [cloudBackupDone, setCloudBackupDone] = useState(false);
  const [manualBackupDone, setManualBackupDone] = useState(false);
  const [cloudBackupVisible, setCloudBackupVisible] = useState(false);
  const [manualBackupVisible, setManualBackupVisible] = useState(false);
  const backupDone = cloudBackupDone || manualBackupDone;
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transfers, setTransfers] = useState<TransferPreview[]>([]);
  const [failedTransfers, setFailedTransfers] = useState<TransferPreview[]>([]);
  const completedNewAddrRef = useRef<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const newSeedRef = useRef<string | null>(null);
  const newMnemonicRef = useRef<string | null>(null);

  const oldSeed: string | null = wallet?.wallets?.['XNO']?.seed ?? null;

  async function onPinAuthenticated() {
    let seed: string;
    try {
      seed = generateSecureSeed();
    } catch {
      Toast.show({ icon: 'fail', content: t('cannotGenerateSecureWallet') });
      return;
    }
    const { mnemonic } = walletLib.fromLegacySeed(seed);
    newSeedRef.current = seed;
    newMnemonicRef.current = mnemonic;
    setStep('backup');
  }

  useEffect(() => {
    if (step !== 'confirm') return;
    const newSeed = newSeedRef.current;
    if (!newSeed || !oldSeed) return;

    setLoadingPreview(true);
    (async () => {
      try {
        const lastAccountIndex = Math.min(parseInt(localStorage.getItem('lastAccountIndex') || '1'), 10);
        const fnToUse = oldSeed.length === 128 ? walletLib.accounts : walletLib.legacyAccounts;
        const oldAccounts = fnToUse(oldSeed, 0, lastAccountIndex - 1);
        const newAccounts = walletLib.legacyAccounts(newSeed, 0, lastAccountIndex - 1);
        const previews: TransferPreview[] = [];

        for (const ticker of Object.keys(wallet.wallets)) {
          const tickerWallet = wallet.wallets[ticker];
          for (let i = 0; i < lastAccountIndex; i++) {
            const oldAddr = ticker === 'XNO'
              ? oldAccounts[i].address
              : convertAddress(oldAccounts[i].address, ticker);
            const newAddr = ticker === 'XNO'
              ? newAccounts[i].address
              : convertAddress(newAccounts[i].address, ticker);
            try {
              const info = await tickerWallet.rpc.account_info(oldAddr);
              if (!info.error && BigInt(info.balance) > 0n) {
                previews.push({ ticker, fromAddr: oldAddr, toAddr: newAddr, balance: info.balance, index: i });
              }
            } catch { /* unopened account */ }
          }
        }
        setTransfers(previews);
      } catch (e) {
        console.warn('Preview fetch failed', e);
      } finally {
        setLoadingPreview(false);
      }
    })();
  }, [step]);

  async function performMigration() {
    const newSeed = newSeedRef.current;
    if (!newSeed || !oldSeed) return;

    setStep('migrating');
    setError(null);

    try {
      const lastAccountIndex = Math.min(parseInt(localStorage.getItem('lastAccountIndex') || '1'), 10);
      const fnToUse = oldSeed.length === 128 ? walletLib.accounts : walletLib.legacyAccounts;
      const oldAccounts = fnToUse(oldSeed, 0, lastAccountIndex - 1);
      const newAccounts = walletLib.legacyAccounts(newSeed, 0, lastAccountIndex - 1);
      const oldPrimaryPk = oldAccounts[0].privateKey;
      const oldPrimaryAddr = oldAccounts[0].address;
      const newPrimaryAddr = newAccounts[0].address;
      const newPrimaryPk = newAccounts[0].privateKey;

      
        // Save new seed as primary
        setProgressMsg(t('migrationSavingNewWallet'));
        await prependWalletSeed(newSeed, false, true);

        localStorage.removeItem('lastAccountIndex');
        localStorage.setItem('activeIndex', '0');
        localStorage.removeItem('activeAddresses');
        localStorage.removeItem('hiddenIndexes');

      // 1. Transfer funds for all tickers × all account indices
      setProgressMsg(t('migrationTransferringFunds'));
      const failed: TransferPreview[] = [];
      for (const ticker of Object.keys(wallet.wallets)) {
        const tickerWallet = wallet.wallets[ticker];
        for (let i = 0; i < lastAccountIndex; i++) {
          const oldAddr = ticker === 'XNO'
            ? oldAccounts[i].address
            : convertAddress(oldAccounts[i].address, ticker);
          const newAddr = ticker === 'XNO'
            ? newAccounts[i].address
            : convertAddress(newAccounts[i].address, ticker);
          try { await tickerWallet.receiveAll(oldAddr); } catch { /* unopened */ }
          try {
            const info = await tickerWallet.rpc.account_info(oldAddr);
            if (!info.error && BigInt(info.balance) > 0n) {
              const prepared = await tickerWallet.prepareSend({
                source: oldAddr,
                destination: newAddr,
                amount: info.balance,
              });
              await tickerWallet.send(prepared);
            }
          } catch (e) {
            console.warn('Fund transfer failed for', ticker, 'index', i, e);
            try {
              const info = await tickerWallet.rpc.account_info(oldAddr);
              if (!info.error && BigInt(info.balance) > 0n) {
                failed.push({ ticker, fromAddr: oldAddr, toAddr: newAddr, balance: info.balance, index: i });
              }
            } catch { /* couldn't confirm balance after failure */ }
          }
        }
      }
      setFailedTransfers(failed);
      
      const oldToken = await getNewChatToken(oldPrimaryAddr, oldPrimaryPk);
      if (oldToken) {
      // 2. Share group keys with new account
      setProgressMsg(t('migrationGroupChats'));
      let chats: any[] = [];
      try {
        const res = await fetcherMessages('/chats', oldPrimaryPk);
        chats = Array.isArray(res) ? res : res?.chats ?? [];
      } catch (e) {
        console.warn('Failed to fetch chats', e);
      }

      for (const chat of chats) {
        if (chat.type === 'group' && chat.sharedAccount) {
          try {
            await addSharedKeyForParticipants(chat.id, [newPrimaryAddr], chat.sharedAccount, oldPrimaryPk);
            await addParticipants(chat.id, [newPrimaryAddr], false);
          } catch (e) {
            console.warn('Failed to share group key for chat', chat.id, e);
          }
        }
      }

      // 3. Fetch and save messages locally (decrypted with old key) instead of re-encrypting
      setProgressMsg(t('migrationSavingPrivateMessages'));
      const CHUNK_SIZE = 1000;
      
      let totalMessages = 0;
      try {
        const countRes = await fetcherMessages('/migration-messages?count=true', oldPrimaryPk);
        totalMessages = countRes?.total ?? 0;
      } catch (e) {
        console.warn('Failed to fetch message count', e);
      }
      const totalChunks = Math.max(1, Math.ceil(totalMessages / CHUNK_SIZE));

      let skip = 0;
      let chunkIndex = 0;
      while (true) {
        let chunk: any[] = [];
        try {
          const res = await fetcherMessages(`/migration-messages?skip=${skip}&limit=${CHUNK_SIZE}`, oldPrimaryPk);
          chunk = res?.messages ?? [];
        } catch (e) {
          console.warn('Failed to fetch migration messages', e);
          break;
        }
        if (chunk.length === 0) break;

        chunkIndex++;
        setProgressMsg(t('migrationSavingMessagesProgress', { current: chunkIndex*CHUNK_SIZE, total: totalMessages }));

        await Promise.all(
          chunk.map(async (msg) => {
            try {
              await saveMessageCache(msg.chatId, msg, oldPrimaryAddr, oldPrimaryPk);
            } catch (e) {
              console.warn('Failed to save message', msg._id, e);
            }
          })
        );
        skip += chunk.length;
        if (chunk.length < CHUNK_SIZE) break;
      }

      // 4. Re-encrypt contacts for new account's key pair
      setProgressMsg(t('migrationContacts'));
      let reencryptedContacts: { encrypted: string; length: number } | null = null;
      try {
        const contactsData = await fetcherMessages('/contacts', oldPrimaryPk);
        if (contactsData?.encrypted) {
          const decrypted = box.decrypt(contactsData.encrypted, oldPrimaryAddr, oldPrimaryPk);
          if (decrypted) {
            reencryptedContacts = {
              encrypted: box.encrypt(decrypted, newPrimaryAddr, newPrimaryPk),
              length: decrypted.length,
            };
          }
        }
      } catch (e) {
        console.warn('Failed to re-encrypt contacts', e);
      }

      // 5. Backend migration (message content already re-encrypted above)
      setProgressMsg(t('migrationUpdatingAccount'));
      const newMessage = `Login to nanwallet.com chat. Date:${new Date().toISOString()}`;
      const newSignature = signMessage(newPrimaryPk, newMessage);
      const migrateRes = await fetch(import.meta.env.VITE_PUBLIC_BACKEND + '/migrate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': oldToken },
        body: JSON.stringify({ newAccount: newPrimaryAddr, newMessage, newSignature, reencryptedContacts }),
      }).then(r => r.json());

      if (migrateRes.error) throw new Error(migrateRes.error);
}
else {        console.warn('Failed to get migration token, skipping chat migration');
      }

      // Pre-warm the new account's chat token so the first load after reload doesn't need an extra round-trip
      try {
        await getNewChatToken(newPrimaryAddr, newPrimaryPk);
      } catch { /* non-fatal */ }

      completedNewAddrRef.current = newPrimaryAddr;
      setStep('done');
    } catch (e: any) {
      console.error('Migration failed', e);
      setError(e?.message ?? t('migrationFailedTryAgain'));
      setStep('confirm');
    }
  }

  const newMnemonic = newMnemonicRef.current ?? '';
  const newSeed = newSeedRef.current;

  let cloudIcon: React.ReactNode = <DownlandOutline />;
  let cloudLabel = t('downloadEncryptedFile');
  if (Capacitor.getPlatform() === 'ios') { cloudIcon = <AiFillApple />; cloudLabel = 'iCloud'; }
  else if (Capacitor.getPlatform() === 'android') { cloudIcon = <AiFillAndroid />; cloudLabel = 'Google Drive'; }

  return (
    <div className="mb-24">
      <NavBar onBack={mustMigrate ? undefined : () => navigate('/me/settings')} backArrow={!mustMigrate}>
        {mustMigrate ? t('migrationRequired') : t('changeSecretPhrase')}
      </NavBar>

      {step === 'intro' && (
        <div className="p-4 flex flex-col gap-4 text-center">
          <UnsafeWalletWarning />
         <div style={{ color: 'var(--adm-color-text-secondary)' }}>
           {t('oldWalletRemainsAccessible')}
          </div>
           <br/><br/>
          <Button
            color="primary"
            size="large"
            shape="rounded"
            className="w-full"
            onClick={() => setPinVisible(true)}
          >
            {t('generateNewRecoveryPhrase')}
          </Button>
        </div>
      )}

      {step === 'backup' && newSeed && (
        <div className="p-4 flex flex-col gap-4">
          <div className="text-xl font-semibold text-center">{t('backupNewRecoveryPhrase')}</div>
          <div className="text-sm text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
            {t('completeOneBackupMethod')}
          </div>
          <List mode="card">
            <List.Item
              description={cloudBackupDone ? t('done') : <span style={{ color: 'var(--adm-color-primary)' }}>{t('backupNow')}</span>}
              prefix={cloudIcon}
              onClick={() => setCloudBackupVisible(true)}
            >
              {cloudLabel}
            </List.Item>
            <List.Item
              description={manualBackupDone ? t('done') : <span style={{ color: 'var(--adm-color-primary)' }}>{t('backupNow')}</span>}
              prefix={<FingerdownOutline />}
              onClick={() => setManualBackupVisible(true)}
            >
              {t('manualWriteDown')}
            </List.Item>
          </List>

          {backupDone && (
            <Button
              color="primary"
              size="large"
              shape="default"
              className="w-full"
              onClick={() => setStep('confirm')}
            >
              {t('continueToMigration')}
            </Button>
          )}
        </div>
      )}

      {step === 'confirm' && (
        <div className="p-4 flex flex-col gap-4">
          <div className="text-xl font-semibold text-center">{t('confirmMigration')}</div>
          <div className="text-sm" style={{ color: 'var(--adm-color-text-secondary)' }}>
            {t('fundsWillBeTransferred')}
          </div>
          {loadingPreview ? (
            <div className="flex justify-center py-4"><DotLoading color="primary" /></div>
          ) : transfers.length === 0 ? (
            <div className="rounded-xl p-3 text-sm text-center" style={{ background: 'var(--adm-color-box)', color: 'var(--adm-color-text-secondary)' }}>
              {t('noFundsToTransfer')}
            </div>
          ) : (
            <List mode="card">
              {transfers.map((transfer, i) => (
                <List.Item
                  key={i}
                  description={
                    <div className="text-sm font-mono break-all">
                      <div>{t('accountNumber', { index: transfer.index })}</div>
                      <div>{t('from')}: {transfer.fromAddr.slice(0, 14)}…{transfer.fromAddr.slice(-6)} </div>
                      <div>{t('to')}:&nbsp;&nbsp; {transfer.toAddr.slice(0, 14)}…{transfer.toAddr.slice(-6)}</div>
                    </div>
                  }
                >
                  <span style={{  }}>
                    {formatAmountMega(rawToMega(transfer.ticker, transfer.balance), transfer.ticker)} {transfer.ticker}
                  </span>
                </List.Item>
              ))}
            </List>
          )}
          {error && (
            <div className="rounded-xl p-3 text-sm" style={{ color: 'var(--adm-color-danger)' }}>
              {error}
            </div>
          )}
          <Button
            color="primary"
            size="large"
            shape="default"
            className="w-full"
            style={{marginBottom: 128}}
            onClick={performMigration}
          >
            {t('startMigration')}
          </Button>
        </div>
      )}

      {step === 'migrating' && (
        <div className="p-8 flex flex-col items-center gap-6">
          <DotLoading color="primary" />
          <div className="text-center text-base">{progressMsg || t('migrating')}</div>
          <div className="text-sm text-center" style={{ color: 'var(--adm-color-text-secondary)' }}>
            {t('keepAppOpenMigration')}
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="p-8 flex flex-col items-center gap-6">
          {failedTransfers.length > 0 ? (
            <ExclamationTriangleOutline fontSize={64} color="var(--adm-color-warning)" />
          ) : (
            <CheckCircleOutline fontSize={64} color="var(--adm-color-success)" />
          )}
          <div className="text-2xl font-semibold text-center">{t('migrationComplete')}</div>
          {failedTransfers.length > 0 ? (
            <div className="w-full rounded-xl p-4" style={{ background: 'var(--adm-color-box)', border: '1px solid var(--adm-color-warning)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--adm-color-warning)' }}>
                {t('accountsNotTransferred', { count: failedTransfers.length })}
              </div>
              {failedTransfers.map((transfer, i) => (
                <div key={i} className="text-xs font-mono mb-1" style={{ color: 'var(--adm-color-text-secondary)' }}>
                  {transfer.ticker} #{transfer.index}: {formatAmountMega(rawToMega(transfer.ticker, transfer.balance), transfer.ticker)} — {t('sendManuallyViaSwitchWallet')}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center flex flex-col gap-2" style={{ color: 'var(--adm-color-text-secondary)' }}>
              <div>{t('newSecureWalletActive')}</div>
              {completedNewAddrRef.current && (
                <div>
                  {t('newMainAddressIs')}
                <div className="text-sm font-mono break-all" style={{ color: 'var(--adm-color-text)' }}>
                  {completedNewAddrRef.current}
                </div> </div>
              )}
            </div>
          )}
          <Button
            color="primary"
            size="large"
            shape="rounded"
            className="w-full"
            onClick={() => {
              window.location.replace('/');
            }}
          >
            {t('reloadApp')}
          </Button>
        </div>
      )}

      <PinAuthPopup
        location="change-secret-phrase"
        description={t('authenticateToGenerateRecoveryPhrase')}
        visible={pinVisible}
        setVisible={setPinVisible}
        onAuthenticated={onPinAuthenticated}
        onCancel={() => setPinVisible(false)}
      />

      <ResponsivePopup
        visible={cloudBackupVisible}
        onClose={() => setCloudBackupVisible(false)}
        closeOnMaskClick
        showCloseButton
        destroyOnClose
        bodyStyle={{ maxHeight: '90dvh', overflowY: 'auto' }}
      >
        {newSeed && (
          <NewSeedCloudBackup
            seed={newSeed}
            onDone={() => { setCloudBackupVisible(false); setCloudBackupDone(true); }}
          />
        )}
      </ResponsivePopup>

      <NewSeedManualBackup
        visible={manualBackupVisible}
        mnemonic={newMnemonic}
        onClose={() => setManualBackupVisible(false)}
        onDone={() => setManualBackupDone(true)}
      />
    </div>
  );
}
