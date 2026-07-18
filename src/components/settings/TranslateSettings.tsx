import { useEffect, useMemo, useState } from "react";
import { CheckList, List, Modal, NavBar, NoticeBar, SearchBar, Switch, Toast } from "antd-mobile";
import { DeleteOutline } from "antd-mobile-icons";
import { BsTranslate } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import useLocalStorageState from "use-local-storage-state";
import { Language, Translation } from "@capacitor-mlkit/translation";
import {
  SUPPORTED_LANGUAGES,
  getDefaultTargetLanguage,
  isTranslationAvailable,
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
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);

  const loadDownloadedModels = async () => {
    if (!isTranslationAvailable()) return;
    try {
      const { languages } = await Translation.getDownloadedModels();
      setDownloadedModels(languages);
    } catch (error) {
      console.log("cannot load downloaded models", error);
    }
  };

  useEffect(() => {
    loadDownloadedModels();
  }, []);

  const sortedLanguages = useMemo(
    () =>
      [...SUPPORTED_LANGUAGES]
        .map((code) => ({ code, name: languageName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .filter(
          ({ code, name }) =>
            !searchText ||
            name.toLowerCase().includes(searchText.toLowerCase()) ||
            code.toLowerCase().includes(searchText.toLowerCase()),
        ),
    [searchText],
  );

  const selectTargetLanguage = async (language: string) => {
    setTargetLanguage(language);
    setLanguagePickerVisible(false);
    setSearchText("");
    if (isTranslationAvailable() && !downloadedModels.includes(language)) {
      Toast.show({ icon: "loading", content: t('downloadingLanguageModel'), duration: 0 });
      try {
        await Translation.downloadModel({ language: language as Language });
        Toast.show({ icon: "success" });
      } catch (error) {
        console.log("cannot download model", error);
        Toast.show({ icon: "fail", content: t('couldNotDownloadLanguageModel') });
      }
      loadDownloadedModels();
    }
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

  return (
    <div className="mb-24">
      <NavBar
        className="app-navbar"
        onBack={() => navigate(-1)} 
        backArrow={true}
      >
        {t('translate')}
      </NavBar>
      {!isTranslationAvailable() && (
        <NoticeBar
          className="mx-4 rounded-lg"
          color="info"
          content={t('translationOnlyOnMobile')}
        />
      )}
      <List mode="card">
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
              onChange={(checked) => {
                HapticsImpact({ style: ImpactStyle.Medium });
                setAutoTranslate(checked);
              }}
            />
          }
        >
          {t('autoTranslateMessages')}
        </List.Item>
      </List>
      <div
        className="text-sm mx-6 mt-2"
        style={{ color: "var(--adm-color-text-secondary)" }}
      >
        {t('translationLocalNote')}
      </div>
      <div className="my-4" />
      {isTranslationAvailable() && (
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
                {downloadedModels.includes(code) && (
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
