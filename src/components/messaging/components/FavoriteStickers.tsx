import { DotLoading, Modal, Popover, Toast } from "antd-mobile";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Compressor from "compressorjs";
import { useLongPress } from "../../../hooks/use-long-press";
import { createCustomSticker, useFavoriteStickers, type StickerEntry } from "./favoriteStickersApi";
import { AddOutline } from "antd-mobile-icons";

const compressSticker = (file: File): Promise<File> =>
  new Promise((resolve, reject) =>
    new Compressor(file, {
      maxHeight: 225,
      quality: 0.85,
      success: f => resolve(f as File),
      error: reject,
    })
  );

type FavStickerItemProps = {
  sticker: StickerEntry;
  onSelect: (sticker: StickerEntry) => void;
  onMoveToFront: (url: string) => void;
  onDelete: (url: string) => void;
};

const FavStickerItem: React.FC<FavStickerItemProps> = ({ sticker, onSelect, onMoveToFront, onDelete }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  const openMenu = useCallback(() => setVisible(true), []);

  useEffect(() => {
    if (!visible) return;
    const handler = () => setVisible(false);
    document.addEventListener('click', handler); // Close menu on outside click
    return () => document.removeEventListener('click', handler);
  }, [visible]);
  const longPressHandlers = useLongPress(openMenu, 400);

  const actions = [
    { key: 'front', text: t('moveToFront') },
    { key: 'delete', text: t('delete'), bold: true },
  ];

  return (
    <Popover.Menu
      mode="dark"
      visible={visible}
      onVisibleChange={setVisible}
      actions={actions}
      onAction={action => {
        setVisible(false);
        if (action.key === 'front') onMoveToFront(sticker.url);
        else if (action.key === 'delete') onDelete(sticker.url);
      }}
      placement="top"
    >
      <div
        {...longPressHandlers}
        onContextMenu={e => { e.preventDefault(); setVisible(true); }}
        onClick={() => { if (!visible) onSelect(sticker); }}
        className="cursor-pointer"
      >
        <img loading="lazy" src={sticker.url} style={{ height: 60 }} />
      </div>
    </Popover.Menu>
  );
};

type Props = {
  stickers: StickerEntry[] | undefined;
  isLoading: boolean;
  onStickerSelect: (sticker: StickerEntry) => void;
  onMoveToFront: (url: string) => void;
  onDelete: (url: string) => void;
  onClear: () => void;
};

const CreateCustomSticker: React.FC = () => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate } = useFavoriteStickers();

  const handleFileSelect = (file: File) => {
    const objectURL = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectURL);

    Modal.confirm({
      confirmText: t('createSticker'),
      cancelText: t('cancel'),
      content: (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>{t('createSticker')}</div>
          <img src={objectURL} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }} />
        </div>
      ),
      onConfirm: async () => {
        try {
          Toast.show({ icon: 'loading', content: t('uploading'), duration: 0 });
          const compressed = await compressSticker(file);
          await createCustomSticker(compressed);
          Toast.show({ icon: 'success', content: t('stickerCreated') });
          mutate();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed';
          Toast.show({ icon: 'fail', content: msg });
        }
      },
      onCancel: cleanup,
      afterClose: cleanup,
    });
  };

  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{ border: '2px dashed var(--adm-color-text-secondary)', borderRadius: 8, width: 60, height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />
      <AddOutline style={{ fontSize: 32 }} />
    </div>
  );
};

const FavoriteStickers: React.FC<Props> = ({ stickers, isLoading, onStickerSelect, onMoveToFront, onDelete, onClear }) => {
  const { t } = useTranslation();
  if (isLoading) return <div style={{ width: '100%', display: 'flex', justifyContent: 'center', paddingTop: 32 }}><DotLoading /></div>;

  if (!stickers?.length) {
    return (
      <div>
        <CreateCustomSticker />
      <div style={{ color: 'var(--adm-color-text-secondary)', textAlign: 'center', width: '100%', marginTop: 32 }}>
        {t('noFavoriteStickers')}
      </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap" style={{ justifyContent: 'space-evenly', gap: 12, width: '100%' }}>
        <CreateCustomSticker />
        {stickers.map((sticker, i) => (
          <FavStickerItem
            key={sticker.url + i}
            sticker={sticker}
            onSelect={onStickerSelect}
            onMoveToFront={onMoveToFront}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
};

export default FavoriteStickers;
