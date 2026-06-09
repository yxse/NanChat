import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DotLoading, Modal, NavBar, Toast } from 'antd-mobile';
import useSWR from 'swr';
import { fetcherMessages } from '../../fetcher';
import { removeCustomSticker } from '../favoriteStickersApi';
import { CreateCustomSticker } from '../FavoriteStickers';

const SWR_OPTS = {
  focusThrottleInterval: 60 * 60 * 1000,
  dedupingInterval: 60 * 60 * 1000,
  keepPreviousData: true,
};

const MyCustomStickers: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: customStickers, isLoading, mutate } = useSWR(
    '/stickers/custom', fetcherMessages, SWR_OPTS,
  );

  const confirmDelete = (url: string) => {
    Modal.confirm({
      title: t('deleteCustomSticker'),
      content: t('deleteCustomStickerWarning'),
      confirmText: t('delete'),
      cancelText: t('cancel'),
      onConfirm: async () => {
        try {
          await removeCustomSticker(url);
          mutate();
        } catch {
          Toast.show({ content: t('somethingWentWrong'), icon: 'fail' });
        }
      },
    });
  };

  return (
    <div>
      <NavBar onBack={() => navigate(-1)}>
        {t('myCustomStickers')}
      </NavBar>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <DotLoading />
        </div>
      )}


      <div style={{ padding: 16 }}>
        <CreateCustomSticker onCreated={mutate} />
      </div>

      {customStickers?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 16 }}>
          {(customStickers as { url: string }[]).map(s => (
            <div key={s.url} style={{ position: 'relative' }}>
              <img src={s.url} style={{ height: 64, objectFit: 'contain', borderRadius: 8, display: 'block' }} loading="lazy" />
              <div
                onClick={() => confirmDelete(s.url)}
                style={{ position: 'absolute', top: -6, right: -6, background: 'var(--adm-color-danger)', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
              >
                ×
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCustomStickers;
