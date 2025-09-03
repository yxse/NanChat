import React from 'react'
import packetIcon from "../../../../public/icons/red_envelope.png"
import packetOpenedIcon from "../../../../public/icons/red_envelope_opened.png"

export function RedPacketIcon({width = 32, style = {}}) {
  return (
    <img src={packetIcon}
     style={{width: width, height: width, display: "inline", ...style}} />
  )
}
export function RedPacketIconOpened({width = 32}) {
  return (
    <img src={packetOpenedIcon}
     style={{width: width, height: width}} />
  )
}
