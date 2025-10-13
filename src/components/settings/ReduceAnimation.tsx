import { CheckList, List, Modal, Radio, reduceMotion, restoreMotion, Toast } from 'antd-mobile'
import { GlobalOutline } from 'antd-mobile-icons'
import React, { useEffect } from 'react'
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { MdAnimation } from 'react-icons/md';
import useLocalStorageState from 'use-local-storage-state';
import { Capacitor } from '@capacitor/core';
import {PowerMode} from 'power-mode';
import { useReduceAnimation } from '../../hooks/use-reduce-animation';



function ReduceAnimation() {
    const { t } = useTranslation();
    const [reduceAnimation, setReduceAnimation] = useReduceAnimation();
    const reduceAnimationSettings = [
      {
        key: 'always',
        label: t('always')
      },
      {
        key: 'onPowerSaving',
        label: t('onPowerSavingMode')
      },
        {   key: 'never',
            label: t('never')
        }
    ]
    if (Capacitor.getPlatform() === 'web') {
        // on web, only show always and never
        reduceAnimationSettings.splice(1, 1);
    }
  return (
        <List.Item 
        onClick={() => {
            Modal.show({
                closeOnMaskClick: true,
                title: t('reduceAnimations'),
            content: <div>
                <CheckList 
                onChange={(value) => {
                    Modal.clear()
                    if (value.length == 0) return
                    setReduceAnimation(value[0] as string)
                    console.log(value)
                }}
                defaultValue={[reduceAnimation]}>
                    {reduceAnimationSettings.map((setting) => {
                        return <CheckList.Item value={setting.key}>
                                {setting.label}
                        </CheckList.Item>
                    })}
                </CheckList>
                <div className='text-sm' style={{color: 'var(--adm-color-text-secondary)', marginTop: 12}}>
                    {t('reduceAnimationsDescription')}
                </div>
            </div>
        })
        }}
        prefix={<MdAnimation fontSize={24} />}>
            {t('reduceAnimations')}
        </List.Item>
  )
}

export default ReduceAnimation