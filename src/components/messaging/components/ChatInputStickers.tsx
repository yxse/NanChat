import { DownOutline, HeartOutline, SearchOutline } from "antd-mobile-icons";
import { memo, useCallback, useState } from "react";
import { Divider, DotLoading, Input } from "antd-mobile";
import useSWR from "swr";
import useLocalStorageState from "use-local-storage-state";
import { useTranslation, Trans } from "react-i18next";
import { fetcherMessages, fetcherMessagesNoAuth, fetcherMessagesPost } from "../fetcher";
import { useWallet } from "../../useWallet";
import { Link } from "react-router-dom";
import FavoriteStickers from "./FavoriteStickers";
import { useFavoriteStickers } from "./favoriteStickersApi";
import { Keyboard } from "@capacitor/keyboard";

const SWR_OPTS = {
  focusThrottleInterval: 60 * 60 * 1000,
  dedupingInterval: 60 * 60 * 1000,
  keepPreviousData: true,
};

const ChatInputStickers: React.FC<{ onStickerSelect: (url: string) => void }> = ({ onStickerSelect }) => {
  const { t } = useTranslation();
  const [lastTab, setLastTab] = useLocalStorageState<string>('stickers-last-tab', { defaultValue: '' });
  const showFavorites = lastTab === 'favorites';
  const collectionId = showFavorites ? null : (lastTab || null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');


  const { data: collections, isLoading: loadingCollections } = useSWR(
    '/stickers/me', fetcherMessages, SWR_OPTS,
  );

  const { data: favorites, isLoading: loadingFavorites, mutate: mutateFavorites } = useFavoriteStickers();

  const selectedId = collectionId ?? collections?.[0]?._id ?? null;

  const { data: collectionStickers, isLoading: loadingCollection } = useSWR(
    !searchOpen && !showFavorites && selectedId ? `/stickers/${selectedId}` : null,
    fetcherMessagesNoAuth,
    SWR_OPTS,
  );

  const trimmedQuery = query.trim();
  const { data: searchResults, isLoading: loadingSearch } = useSWR(
    searchOpen && trimmedQuery ? `/stickers/search?q=${encodeURIComponent(trimmedQuery)}` : null,
    fetcherMessagesNoAuth,
    { dedupingInterval: 300, keepPreviousData: true },
  );

  const stickers = searchOpen ? (trimmedQuery ? searchResults : collectionStickers) : collectionStickers;
  const loadingStickers = searchOpen ? loadingSearch : loadingCollection;

  const handleStickerSelect = useCallback((url: string) => {
    onStickerSelect(url);
    if (searchOpen) { setSearchOpen(false); setQuery(''); }
  }, [onStickerSelect, searchOpen]);

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginTop: 12, marginLeft: 16, marginRight: 48, overflowX: 'auto', paddingBottom: 4, alignItems: 'center' }}>
        {searchOpen
          ? (
            <Input
            onEnterPress={() => {
                Keyboard.hide();
              }
            }
              onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setQuery(''); } }}
              clearable
              enterKeyHint="search"
              autoFocus
              placeholder={t('searchStickers')}
              value={query}
              onChange={setQuery}
              style={{ flex: 1 }}
            />
          )
          : (
            <>
              {/* Favorites icon */}
              <div
                onClick={() => setLastTab('favorites')}
                style={{
                  backgroundColor: showFavorites ? 'var(--adm-color-border)' : 'unset',
                  padding: 8,
                  borderRadius: 8,
                  cursor: 'pointer',
                  flexShrink: 0,
                  fontSize: 24,
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--adm-color-text-secondary)',
                }}
              >
                <HeartOutline />
              </div>

              {/* Collection tabs */}
              {loadingCollections
                ? <DotLoading />
                : collections?.map((col: { _id: string; name: string; logo: string }) => (
                  <div
                    key={col._id}
                    onClick={() => setLastTab(col._id)}
                    style={{
                      backgroundColor: !showFavorites && selectedId === col._id ? 'var(--adm-color-border)' : 'unset',
                      padding: 4,
                      borderRadius: 8,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <img 
                    style={{ height: 32, borderRadius: 6, 
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      pointerEvents: 'none',
                    }}
                    draggable="false" loading="lazy" src={col.logo} title={col.name} 
                    />
                  </div>
                ))
              }
            </>
          )
        }

        <div
          onClick={() => { setSearchOpen(o => !o); setQuery(''); }}
          style={{ position: 'absolute', right: 16, fontSize: 24, marginTop: 8, color: 'var(--adm-color-text-secondary)', cursor: 'pointer', zIndex: 1 }}
        >
          {searchOpen ? <DownOutline /> : <SearchOutline />}
        </div>
      </div>

      <Divider style={{ margin: '8px 0' }} />

      <div style={{ position: 'relative', height: searchOpen ? 600 : 250, overflowY: 'scroll', marginTop: 8 }}>
        <div className="flex flex-wrap" style={{ justifyContent: 'space-evenly', gap: 12 }}>
          {showFavorites && !searchOpen
            ? (
              <FavoriteStickers
                stickers={favorites}
                isLoading={loadingFavorites}
                onStickerSelect={s => handleStickerSelect(s.url)}
                onMoveToFront={async (url) => {
                  await fetcherMessagesPost('/stickers/favorites/move-to-front', { url });
                  mutateFavorites();
                }}
                onDelete={async (url) => {
                  await fetcherMessagesPost('/stickers/favorites/remove', { url });
                  mutateFavorites();
                }}
                onClear={async () => {
                  await fetcherMessagesPost('/stickers/favorites/clear', {});
                  mutateFavorites([]);
                }}
              />
            )
            : loadingStickers
              ? <DotLoading />
              : stickers?.map((sticker: { _id: string; url: string; name?: string }) => (
                <div key={sticker._id} onClick={() => handleStickerSelect(sticker.url)} className="cursor-pointer">
                  <img loading="lazy" src={sticker.url} style={{ height: 60 }} />
                  {searchOpen && (
                    <div
                      className="text-xs"
                      style={{ color: 'var(--adm-color-text-secondary)', textAlign: 'center', maxWidth: 75, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 4 }}
                    >
                      {sticker.name}
                    </div>
                  )}
                </div>
              ))
          }

          {!showFavorites && !searchOpen && !loadingCollections && collections?.length === 0 && (
            <div style={{ color: 'var(--adm-color-text-secondary)', textAlign: 'center', width: '100%', marginTop: 32 }}>
              <Trans i18nKey="noStickersOwned" components={{ lnk: <Link to="/me/stickers" className="underline" /> }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default memo(ChatInputStickers);
