import React, { useState } from 'react'
import { AiOutlineReload, AiOutlineSync } from 'react-icons/ai'
import { MdOutlineCheck, MdOutlineSync, MdRefresh } from 'react-icons/md'
import { isTouchDevice } from '../utils/isTouchDevice'


const UpdatedIcon = ({size, style}) => {
    return (
        <span className='flex items-center'>
        <MdOutlineCheck size={size} style={{
            color: 'var(--adm-color-primary)',
        }}/> <span style={style} className='text-base ml-1'>Updated</span>
        </span>
    )
}
function RefreshButton({onRefresh}) {
  const [state, setState] = useState<'idle' | 'loading' | 'updated'>('idle')

    const onClick = async () => {
        setState('loading')
        if (onRefresh) {
            await onRefresh()
        }   
        setState('updated')
        setTimeout(() => {
            setState('idle')
        }, 2000)
    }
    const style = { opacity: 0.8 } 
    const size = 22
    if (isTouchDevice()) {
        return null
    }
    return (
        <div style={{display: 'inline-block', alignItems: 'baseline'}}>
            {state === 'idle' && <MdRefresh size={size} style={{ opacity: 0.8, cursor: "pointer" }} onClick={onClick} /> }
            {state === 'loading' &&  <MdOutlineSync className='ai-spin' size={size} style={style} />}
            {state === 'updated' && <UpdatedIcon size={size} style={style}/>}
        </div>
    )
}

export default RefreshButton