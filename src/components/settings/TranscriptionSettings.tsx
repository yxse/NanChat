import { useEffect, useState } from "react";
import { Button, CheckList, List, Modal, NavBar, ProgressBar, Switch, Toast } from "antd-mobile";
import { DeleteOutline } from "antd-mobile-icons";
import { MdOutlineMemory, MdOutlineSubtitles } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { useTranslation } from "react-i18next";
import {
  AUTO_TRANSCRIBE_KEY,
  MODEL_SETTING_KEY,
  TranscriptionModel,
  TranscriptionModelSetting,
  confirmModelDownload,
  deleteModels,
  detectGpu,
  getAvailableModels,
  getModelSizeMB,
  isModelDownloaded,
  isTranscriptionSupported,
  loadModel,
  resolveModel,
  useTranscriptionState,
} from "../../services/transcription.service";
import { ResponsivePopup } from "../Settings";
import { HapticsImpact } from "../../utils/haptic";
import { ImpactStyle } from "@capacitor/haptics";

const MODEL_NAMES: Record<TranscriptionModel, string> = {
  small: "Whisper Small",
  base: "Whisper Base",
  tiny: "Whisper Tiny",
};

function TranscriptionSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const supported = isTranscriptionSupported();
  const [modelSetting, setModelSetting] = useLocalStorageState<TranscriptionModelSetting>(MODEL_SETTING_KEY, {
    defaultValue: "auto",
  });
  const [autoTranscribe, setAutoTranscribe] = useLocalStorageState(AUTO_TRANSCRIBE_KEY, { defaultValue: false });
  const [models, setModels] = useState<TranscriptionModel[]>([]);
  const [sizes, setSizes] = useState<Partial<Record<TranscriptionModel, number>>>({});
  const [webgpu, setWebgpu] = useState<boolean | null>(null);
  const [model, setModel] = useState<TranscriptionModel | null>(null);
  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const transcriptionState = useTranscriptionState();

  const refresh = async () => {
    const resolved = await resolveModel(modelSetting);
    setModel(resolved);
    setDownloaded(await isModelDownloaded(resolved));
  };

  useEffect(() => {
    if (!supported) return;
    (async () => {
      setWebgpu((await detectGpu()).webgpu);
      const available = await getAvailableModels();
      setModels(available);
      const entries = await Promise.all(available.map(async (m) => [m, await getModelSizeMB(m)] as const));
      setSizes(Object.fromEntries(entries));
    })();
  }, []);

  useEffect(() => {
    if (supported) refresh();
  }, [modelSetting]);

  const download = async () => {
    if (!model || busy) return;
    if (!(await confirmModelDownload(model))) return;
    setBusy(true);
    try {
      await loadModel(model);
      Toast.show({ icon: "success" });
    } catch (error) {
      console.error("speech model download failed", error);
      Toast.show({ icon: "fail", content: t("transcriptionDownloadFailed") });
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const remove = () => {
    Modal.show({
      closeOnMaskClick: true,
      closeOnAction: true,
      title: t("transcriptionRemoveModelTitle"),
      content: (
        <div className="text-center text-sm" style={{ color: "var(--adm-color-text-secondary)" }}>
          {t("transcriptionRemoveModelContent")}
        </div>
      ),
      actions: [
        {
          key: "remove",
          text: t("remove"),
          danger: true,
          onClick: async () => {
            try {
              await deleteModels();
            } catch (error) {
              console.error("cannot delete speech models", error);
              Toast.show({ icon: "fail", content: t("couldNotRemoveModel") });
            }
            refresh();
          },
        },
        { key: "cancel", text: t("cancel") },
      ],
    });
  };

  const selectModel = (value: TranscriptionModelSetting) => {
    setPickerVisible(false);
    setModelSetting(value);
  };

  const modelLabel = (m: TranscriptionModel) => `${MODEL_NAMES[m]}${sizes[m] ? ` · ~${sizes[m]} MB` : ""}`;
  const downloading = busy && transcriptionState.status === "downloading";

  return (
    <div className="mb-24">
      <NavBar className="app-navbar" onBack={() => navigate(-1)} backArrow={true}>
        {t("voiceTranscription")}
      </NavBar>
      {!supported ? (
        <div className="text-sm mx-6 mt-4" style={{ color: "var(--adm-color-text-secondary)" }}>
          {t("transcriptionUnsupported")}
        </div>
      ) : (
        <>
          <List mode="card">
            <List.Item
              prefix={<MdOutlineMemory size={24} />}
              onClick={() => setPickerVisible(true)}
              extra={model ? MODEL_NAMES[model] : ""}
            >
              {t("transcriptionModel")}
            </List.Item>
            <List.Item
              prefix={<MdOutlineSubtitles size={24} />}
              arrow={null}
              description={t("autoTranscribeDesc")}
              extra={
                <Switch
                  checked={autoTranscribe}
                  onChange={(checked) => {
                    HapticsImpact({ style: ImpactStyle.Medium });
                    setAutoTranscribe(checked);
                  }}
                />
              }
            >
              {t("autoTranscribe")}
            </List.Item>
          </List>
          <div className="text-sm mx-6 mt-2" style={{ color: "var(--adm-color-text-secondary)" }}>
            {t("transcriptionLocalNote")}
          </div>
          <div className="my-4" />
          {model && downloaded !== null && (
            <List mode="card" header={t("transcriptionModelStatus")}>
              <List.Item
                arrow={null}
                description={downloading ? <ProgressBar percent={Math.round(transcriptionState.progress * 100)} style={{ marginTop: 6 }} /> : undefined}
                extra={
                  downloaded ? (
                    <DeleteOutline
                      fontSize={20}
                      style={{ color: "var(--adm-color-danger)", cursor: "pointer" }}
                      onClick={remove}
                    />
                  ) : (
                    <Button size="small" color="primary" loading={busy} onClick={download}>
                      {t("download")}
                    </Button>
                  )
                }
              >
                {modelLabel(model)}
                <div className="text-xs" style={{ color: "var(--adm-color-text-secondary)" }}>
                  {downloaded ? t("downloaded") : t("transcriptionNotDownloaded")}
                </div>
              </List.Item>
            </List>
          )}
          {webgpu !== null && (
            <div className="text-xs mx-6 mt-2" style={{ color: "var(--adm-color-text-secondary)" }}>
              {webgpu ? t("transcriptionGpuAvailable") : t("transcriptionGpuUnavailable")}
            </div>
          )}
        </>
      )}
      <ResponsivePopup
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        closeOnMaskClick={true}
        destroyOnClose
      >
        <div className="checkListContainer">
          <CheckList
            defaultValue={[modelSetting]}
            onChange={(value) => {
              if (value.length === 0) return;
              selectModel(value[0] as TranscriptionModelSetting);
            }}
          >
            <CheckList.Item value="auto">
              <div>{t("transcriptionModelAuto")}</div>
              <div className="text-xs" style={{ color: "var(--adm-color-text-secondary)" }}>
                {t("transcriptionModelAutoDesc")}
              </div>
            </CheckList.Item>
            {models.map((m) => (
              <CheckList.Item key={m} value={m}>
                <div>{modelLabel(m)}</div>
                <div className="text-xs" style={{ color: "var(--adm-color-text-secondary)" }}>
                  {t(`transcriptionModelDesc_${m}`)}
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </div>
      </ResponsivePopup>
    </div>
  );
}

export default TranscriptionSettings;
