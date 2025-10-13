import { CheckList, List, Modal, Radio } from 'antd-mobile'
import { GlobalOutline } from 'antd-mobile-icons'
import React from 'react'
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

function ChangeLanguage() {
    const { t } = useTranslation();
    const languages = [
      {
        key: 'ar',
        label: 'العربية',
      },
      {
        key: 'de',
        label: 'Deutsch',
      },
      {
        key: 'en',
        label: "English",
      },
      {
        key: 'es',
        label: 'Español',
      },
      {
        key: 'fr',
        label: 'Français',
      },
      {
        key: 'it',
        label: 'Italiano',
      },
      {
        key: 'ja',
        label: '日本語',
      },
      {
        key: 'nl',
        label: 'Nederlands',
      },
      {
        key: 'pt',
        label: 'Português',
      },
      {
        key: 'pl',
        label: 'Polski',
      },
      {
        key: 'ru',
        label: 'Русский',
      },
      {
        key: 'tr',
        label: 'Türkçe',
      },
      {
        key: 'zh',
        label: '中文',
      },
      {
        key: 'uk',
        label: 'Українська',
      },
      {
        key: 'zh-Hant',
        label: '繁體中文',
      },
    ]
  return (
        <List.Item 
        onClick={() => {
            Modal.show({
                closeOnMaskClick: true,
                title: t('language'), 
            content: <div>
                <CheckList 
                onChange={(value) => {
                    Modal.clear()
                    if (value.length == 0) return
                    console.log(value)
                    i18n.changeLanguage(value)
                }}
                defaultValue={[i18n.language]}>
                    {languages.map((language => {
                        return <CheckList.Item value={language.key}>
                                {language.label}
                        </CheckList.Item>
                    }))}
                </CheckList>
            </div>
        })
        }}
        prefix={<GlobalOutline fontSize={24} />}>
            {t('language')}
        </List.Item>
  )
}

export default ChangeLanguage