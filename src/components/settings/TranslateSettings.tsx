import { useEffect, useMemo, useState } from "react";
import { CheckList, List, Modal, NavBar, SearchBar, Switch, Toast } from "antd-mobile";
import { DeleteOutline } from "antd-mobile-icons";
import { BsTranslate } from "react-icons/bs";
import { MdOutlineCloud } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { Language, Translation } from "@capacitor-mlkit/translation";
import {
  PROVIDER_NAMES,
  TranslationProvider,
  checkAppleTranslationAvailable,
  confirmModelDownload,
  getAppleSupportedLanguages,
  getDefaultProvider,
  getDefaultTargetLanguage,
  getPlatformProviders,
  getProviderLanguages,
  isCloudProvider,
  languageName,
} from "../../services/translation.service";
import { ResponsivePopup } from "../Settings";
import { HapticsImpact } from "../../utils/haptic";
import { ImpactStyle } from "@capacitor/haptics";
import { useTranslation } from "react-i18next";

function TranslateSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useLocalStorageState<string>(
    "translateTargetLanguage",
    { defaultValue: getDefaultTargetLanguage() },
  );
  const [autoTranslate, setAutoTranslate] = useLocalStorageState(
    "autoTranslateMessages",
    { defaultValue: false },
  );
  const [storedProvider, setProvider] = useLocalStorageState<TranslationProvider>(
    "translateProvider",
    { defaultValue: getDefaultProvider() },
  );
  const [platformProviders, setPlatformProviders] = useState(getPlatformProviders());
  const [appleLanguages, setAppleLanguages] = useState<string[]>([]);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [providerPickerVisible, setProviderPickerVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);

  const provider: TranslationProvider = platformProviders.includes(storedProvider)
    ? storedProvider
    : getDefaultProvider();
  const isCloud = isCloudProvider(provider);
  const mlkitAvailable = platformProviders.includes("mlkit");

  const loadDownloadedModels = async () => {
    if (!mlkitAvailable) return;
    try {
      const { languages } = await Translation.getDownloadedModels();
      setDownloadedModels(languages);
    } catch (error) {
      console.log("cannot load downloaded models", error);
    }
  };

  useEffect(() => {
    loadDownloadedModels();
    checkAppleTranslationAvailable().then(async (available) => {
      setPlatformProviders(getPlatformProviders());
      if (available) setAppleLanguages(await getAppleSupportedLanguages());
    });
  }, []);

  const providerLanguages = useMemo(
    () => (provider === "apple" ? appleLanguages : getProviderLanguages(provider)),
    [provider, appleLanguages],
  );

  const sortedLanguages = useMemo(
    () =>
      [...providerLanguages]
        .map((code) => ({ code, name: languageName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          ({ code, name }) =>
            !searchText ||
            name.toLowerCase().includes(searchText.toLowerCase()) ||
            code.toLowerCase().includes(searchText.toLowerCase()),
        ),
    [searchText, providerLanguages],
  );

  const providerLabel = (p: TranslationProvider) => t(`translationProvider_${p}`);

  const downloadModel = async (language: string) => {
    if (!mlkitAvailable || downloadedModels.includes(language)) return;
    // declined on mobile data: translate() downloads it later, once on Wi-Fi
    if (!(await confirmModelDownload([language]))) return;
    Toast.show({ icon: "loading", content: t('downloadingLanguageModel'), duration: 0 });
    try {
      await Translation.downloadModel({ language: language as Language });
      Toast.show({ icon: "success" });
    } catch (error) {
      console.log("cannot download model", error);
      Toast.show({ icon: "fail", content: t('couldNotDownloadLanguageModel') });
    }
    loadDownloadedModels();
  };

  const selectTargetLanguage = async (language: string) => {
    setTargetLanguage(language);
    setLanguagePickerVisible(false);
    setSearchText("");
    if (provider === "mlkit") await downloadModel(language);
  };

  const selectProvider = (newProvider: TranslationProvider) => {
    setProviderPickerVisible(false);
    if (newProvider === provider) return;
    setProvider(newProvider);
    // the target language may not be offered by the new provider
    const languages = newProvider === "apple" ? appleLanguages : getProviderLanguages(newProvider);
    if (languages.length > 0 && !languages.includes(targetLanguage)) {
      setTargetLanguage(languages.includes("en") ? "en" : languages[0]);
    }
    if (newProvider === "mlkit") downloadModel(targetLanguage);
  };

  const toggleAutoTranslate = async (checked: boolean) => {
    HapticsImpact({ style: ImpactStyle.Medium });
    if (checked && isCloud) {
      const confirmed = await Modal.confirm({
        title: t('autoTranslateCloudTitle'),
        content: t('autoTranslateCloudContent', { service: PROVIDER_NAMES[provider] }),
        confirmText: t('enable'),
        cancelText: t('cancel'),
      });
      if (!confirmed) return;
    }
    setAutoTranslate(checked);
  };

  const removeModel = (language: string) => {
    Modal.show({
      closeOnMaskClick: true,
      closeOnAction: true,
      title: t('removeLanguageModelTitle', { language: languageName(language) }),
      content: (
        <div className="text-center text-sm" style={{ color: "var(--adm-color-text-secondary)" }}>
          {t('removeLanguageModelContent')}
        </div>
      ),
      actions: [
        {
          key: "remove",
          text: t('remove'),
          danger: true,
          onClick: async () => {
            try {
              await Translation.deleteDownloadedModel({ language: language as Language });
            } catch (error) {
              console.log("cannot delete model", error);
              Toast.show({ icon: "fail", content: t('couldNotRemoveModel') });
            }
            loadDownloadedModels();
          },
        },
        { key: "cancel", text: t('cancel') },
      ],
    });
  };

  const note = isCloud
    ? t('translationCloudNote', { service: PROVIDER_NAMES[provider] })
    : provider === "apple"
      ? t('translationAppleNote')
      : t('translationLocalNote');

  return (
    <div className="mb-24">
      <NavBar
        className="app-navbar"
        onBack={() => navigate(-1)}
        backArrow={true}
      >
        {t('translate')}
      </NavBar>
      <List mode="card">
        <List.Item
          prefix={<MdOutlineCloud size={24} />}
          onClick={() => setProviderPickerVisible(true)}
          extra={providerLabel(provider)}
        >
          {t('translationService')}
        </List.Item>
        <List.Item
          prefix={<BsTranslate size={24} />}
          onClick={() => setLanguagePickerVisible(true)}
          extra={languageName(targetLanguage)}
        >
          {t('translateTextTo')}
        </List.Item>
        <List.Item
          arrow={null}
          description={t('autoTranslateMessagesDesc')}
          extra={
            <Switch
              checked={autoTranslate}
              onChange={toggleAutoTranslate}
            />
          }
        >
          {t('autoTranslateMessages')}
        </List.Item>
      </List>
      <div
        className="text-sm mx-6 mt-2"
        style={{ color: isCloud ? "var(--adm-color-warning)" : "var(--adm-color-text-secondary)" }}
      >
        {note}
      </div>
      <div className="my-4" />
      {provider === "mlkit" && (
        <List mode="card" header={t('downloadedLanguageModels')}>
          {downloadedModels.length === 0 && (
            <List.Item arrow={null}>
              <span style={{ color: "var(--adm-color-text-secondary)" }}>
                {t('noLanguageModelDownloaded')}
              </span>
            </List.Item>
          )}
          {downloadedModels.map((language) => (
            <List.Item
              key={language}
              arrow={null}
              extra={
                <DeleteOutline
                  fontSize={20}
                  style={{ color: "var(--adm-color-danger)", cursor: "pointer" }}
                  onClick={() => removeModel(language)}
                />
              }
            >
              {languageName(language)}
            </List.Item>
          ))}
        </List>
      )}
      <ResponsivePopup
        visible={providerPickerVisible}
        onClose={() => setProviderPickerVisible(false)}
        closeOnMaskClick={true}
        destroyOnClose
      >
        <div className="checkListContainer">
          <CheckList
            defaultValue={[provider]}
            onChange={(value) => {
              if (value.length === 0) return;
              selectProvider(value[0] as TranslationProvider);
            }}
          >
            {platformProviders.map((p) => (
              <CheckList.Item
                key={p}
                value={p}
              >
                <div>{providerLabel(p)}</div>
                <div className="text-xs" style={{ color: "var(--adm-color-text-secondary)" }}>
                  {t(`translationProviderDesc_${p}`)}
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </div>
      </ResponsivePopup>
      <ResponsivePopup
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
        closeOnMaskClick={true}
        destroyOnClose
      >
        <div className="searchBarContainer">
          <SearchBar
            placeholder={t('searchLanguage')}
            value={searchText}
            onChange={setSearchText}
          />
        </div>
        <div className="checkListContainer" style={{ maxHeight: "60dvh", overflowY: "auto" }}>
          <CheckList
            defaultValue={[targetLanguage]}
            onChange={(value) => {
              if (value.length === 0) return;
              selectTargetLanguage(value[0] as string);
            }}
          >
            {sortedLanguages.map(({ code, name }) => (
              <CheckList.Item key={code} value={code}>
                {name}
                {provider === "mlkit" && downloadedModels.includes(code) && (
                  <span
                    className="text-xs ml-2"
                    style={{ color: "var(--adm-color-text-secondary)" }}
                  >
                    {t('downloaded')}
                  </span>
                )}
              </CheckList.Item>
            ))}
          </CheckList>
        </div>
      </ResponsivePopup>
    </div>
  );
}

export default TranslateSettings;
