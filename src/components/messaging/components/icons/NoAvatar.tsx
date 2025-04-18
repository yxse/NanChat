import { UserOutline } from "antd-mobile-icons";

export function NoAvatar({ width = '100%', height = '100%', iconSize = 64 }) {
    // Calculate icon size based on container dimensions
    // This is a simple approach - you might want to adjust the formula
    const calculatedIconSize = typeof width === 'number' ? width / 1.25 : iconSize;
    
    return (
      <div 
        style={{
          background: 'var(--adm-color-text-secondary)', 
          borderRadius: 8, 
          width: width,
          height: height || width // Make height equal to width if not specified
        }}
        className="flex justify-center items-center"
      >
        <UserOutline 
          style={{color: 'white'}} 
          fontSize={calculatedIconSize}
        />
      </div>
    );
  }