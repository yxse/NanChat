import { Button, Toast } from "antd-mobile"
import { useState } from "react"
import { AiOutlineCopy, AiOutlineSnippets } from "react-icons/ai"
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { copyToClipboard } from "../../utils/format";

export const CopyIcon = ({fontSize, className, onClick}) => {
    return (
        <AiOutlineCopy fontSize={fontSize} className={className} onClick={onClick} />
    )
}

export const PasteIcon = ({fontSize, className, onClick}) => {
    return (
        <AiOutlineSnippets fontSize={fontSize} className={className} onClick={onClick} />
    )
}

export const CopyButton = ({textToCopy, copyText, copiedText, color = "primary", onCopy, onAnimationEnd}) => {
    const [isCopied, setIsCopied] = useState(false);
    return (<Button
    shape="rounded"
          size="large"
          color={isCopied ? "success" : color}
          onClick={() => {
            copyToClipboard(textToCopy).then(() => {
                setIsCopied(true);
                if (onCopy) {
                    onCopy();
                }
                setTimeout(() => {
                  setIsCopied(false);
                    if (onAnimationEnd) {
                        onAnimationEnd();
                    }
                }, 1500);
            }
            )
          }}
          // bacground animation
          style={{ 
            transition: "background-color 0.1s",
        }}
          className="w-full"
        >
            {
                isCopied ? copiedText : copyText
            }
        </Button>
    )
}