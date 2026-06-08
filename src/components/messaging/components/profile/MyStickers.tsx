import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Divider, DotLoading, List, NavBar, Popup, Toast } from 'antd-mobile';
import useSWR from 'swr';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { fetcherMessages, fetcherMessagesNoAuth, fetcherMessagesPost } from '../../fetcher';
import { useWallet } from '../../../useWallet';

type Collection = { _id: string; name: string; logo: string };

const SWR_OPTS = {
  focusThrottleInterval: 60 * 60 * 1000,
  dedupingInterval: 60 * 60 * 1000,
  keepPreviousData: true,
};

const reorder = (list: Collection[], from: number, to: number): Collection[] => {
  const result = [...list];
  const [removed] = result.splice(from, 1);
  result.splice(to, 0, removed);
  return result;
};

const MyStickers: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: myCollections, mutate: mutateMyCollections } = useSWR(
    '/stickers/me', fetcherMessages,
    SWR_OPTS,
  );
  const { data: allCollections, isLoading: loadingAll } = useSWR('/stickers/collections', fetcherMessagesNoAuth, SWR_OPTS);

  const [previewCollection, setPreviewCollection] = useState<Collection | null>(null);
  const { data: previewStickers, isLoading: loadingPreview } = useSWR(
    previewCollection ? `/stickers/${previewCollection._id}` : null,
    fetcherMessagesNoAuth,
    { dedupingInterval: 60 * 60 * 1000, keepPreviousData: true },
  );

  const [sorting, setSorting] = useState(false);
  const [orderedCollections, setOrderedCollections] = useState<Collection[]>([]);

  useEffect(() => {
    if (sorting && myCollections) setOrderedCollections(myCollections);
  }, [sorting, myCollections]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    setOrderedCollections(prev => reorder(prev, result.source.index, result.destination!.index));
  };

  const saveOrder = async () => {
    try {
      await fetcherMessagesPost('/stickers/me/reorder', { collectionIds: orderedCollections.map(c => c._id) });
      await mutateMyCollections();
      setSorting(false);
    } catch {
      Toast.show({ content: t('failedToSaveOrder'), icon: 'fail' });
    }
  };

  const toggle = async (collectionId: string, isAdded: boolean) => {
    const url = isAdded ? '/stickers/me/remove' : '/stickers/me/add';
    try {
      await fetcherMessagesPost(url, { collectionId });
      await mutateMyCollections();
    } catch {
      Toast.show({ content: t('somethingWentWrong'), icon: 'fail' });
    }
  };

  const myIds = new Set((myCollections || []).map((c: Collection) => c._id));

  return (
    <div>
      <NavBar
        onBack={() => navigate(-1)}
        right={
          <span
            style={{ 
              color:  sorting ? 'var(--adm-color-primary)' : 'unset',
              cursor: 'pointer' }}
            onClick={() => sorting ? saveOrder() : setSorting(true)}
          >
            {sorting ? t('done') : t('sort')}
          </span>
        }
      >
        {t('stickerGallery')}
      </NavBar>

      {/* ── Sort mode ────────────────────────────────── */}
      {sorting && (
        <List mode="card">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="collections">
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  {orderedCollections.map((col, index) => (
                    <Draggable key={col._id} draggableId={col._id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                            opacity: snapshot.isDragging ? 0.8 : 1,
                          }}
                        >
                          <List.Item
                            arrowIcon={false}
                            prefix={<img src={col.logo} style={{ height: 40, width: 40, borderRadius: 8, objectFit: 'cover' }} />}
                          >
                            {col.name}
                          </List.Item>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </List>
      )}

      {/* ── Normal mode ──────────────────────────────── */}
      {!sorting && (
        <>
          <List mode="card">
            <List.Item onClick={() => navigate('/me/stickers/custom')}>
              {t('myCustomStickers')}
            </List.Item>
          </List>
          {myCollections?.length > 0 && (
            <List mode="card">
              {(myCollections as Collection[]).map(col => (
                <List.Item
                  key={col._id}
                  arrowIcon={false}
                  prefix={<img src={col.logo} style={{ height: 40, width: 40, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => setPreviewCollection(col)} />}
                  extra={
                    <Button size="small" color="default" onClick={(e) => { e.stopPropagation(); toggle(col._id, true); }}>
                      {t('remove')}
                    </Button>
                  }
                  onClick={() => setPreviewCollection(col)}
                >
                  {col.name}
                </List.Item>
              ))}
            </List>
          )}

          <Divider />

          {loadingAll
            ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><DotLoading /></div>
            : (
              <List mode="card">
                {(allCollections as Collection[])?.filter(col => !myIds.has(col._id)).map(col => (
                  <List.Item
                    key={col._id}
                    arrowIcon={false}
                    prefix={<img src={col.logo} style={{ height: 40, width: 40, borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }} onClick={() => setPreviewCollection(col)} />}
                    extra={
                      <Button size="small" color="primary" onClick={(e) => { e.stopPropagation(); toggle(col._id, false); }}>
                        {t('add')}
                      </Button>
                    }
                    onClick={() => setPreviewCollection(col)}
                  >
                    {col.name}
                  </List.Item>
                ))}
              </List>
            )
          }
        </>
      )}

      {/* ── Preview popup ────────────────────────────── */}
      <Popup
        visible={!!previewCollection}
        onMaskClick={() => setPreviewCollection(null)}
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto', padding: 16 }}
      >
        {previewCollection && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <img src={previewCollection.logo} style={{ height: 40, width: 40, borderRadius: 8, objectFit: 'cover' }} />
              <strong style={{ fontSize: 18 }}>{previewCollection.name}</strong>
            </div>
            {loadingPreview
              ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><DotLoading /></div>
              : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-evenly' }}>
                  {previewStickers?.map((s: { _id: string; url: string; name: string }) => (
                    <div key={s._id} style={{ textAlign: 'center' }}>
                      <img src={s.url} style={{ height: 64, objectFit: 'contain' }} loading="lazy" />
                      <div style={{ fontSize: 11, color: 'var(--adm-color-text-secondary)', maxWidth: 70, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', marginTop: 4 }}>
                        {s.name}
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </>
        )}
      </Popup>
    </div>
  );
};

export default MyStickers;
