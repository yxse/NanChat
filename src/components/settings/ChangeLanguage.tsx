import { CheckList, List, Modal, Radio } from 'antd-mobile'
import { GlobalOutline } from 'antd-mobile-icons'
import React from 'react'
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';

function ChangeLanguage() {
    const { t } = useTranslation();
    const languages = [
      {
        key: 'en',
        label: "English",
      },
      {
        key: 'fr',
        label: 'Français',
      },
    //   {
    //     key: 'es',
    //     label: 'Español',
    //   },
    //   {
    //     key: 'zh',
    //     label: '中文',
    //   },
    //   {
    //     key: 'ar',
    //     label: 'العربية',
    //   },
    //   {
    //     key: 'ru',
    //     label: 'Русский',
    //   },
    //   {
    //     key: 'ja',
    //     label: '日本語',
    //   },
    //   {
    //     key: 'de',
    //     label: 'Deutsch',
    //   },
    //   {
    //     key: 'tr',
    //     label: 'Türkçe',
    //   },
    //   {
    //     key: 'it',
    //     label: 'Italiano',
    //   }
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