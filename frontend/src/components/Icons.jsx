const Svg = ({ children, size = 24, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {children}
  </svg>
)

export const HotelIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M3 21h18" />
    <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <path d="M15 9h4a1 1 0 0 1 1 1v11" />
    <path d="M8 8h2M8 12h2M8 16h2" />
  </Svg>
)

export const BedIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" />
    <path d="M2 15h20" />
    <path d="M6 10V7a1 1 0 0 1 1-1h3v4M14 10V6h4a1 1 0 0 1 1 1v3" />
    <path d="M2 18v2M22 18v2" />
  </Svg>
)

export const TwinIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M2 18v-6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v6" />
    <path d="M2 15h20" />
    <path d="M6 10V7a1 1 0 0 1 1-1h2v4M15 10V7a1 1 0 0 1 1-1h2v4" />
    <path d="M12 12v3" />
  </Svg>
)

export const FamilyIcon = ({ size }) => (
  <Svg size={size}>
    <circle cx="9" cy="6.5" r="2.5" />
    <circle cx="16.5" cy="7" r="2" />
    <path d="M4 20v-1.5A4.5 4.5 0 0 1 8.5 14h1A4.5 4.5 0 0 1 14 18.5V20" />
    <path d="M15 14.5a3.5 3.5 0 0 1 4.5 3.3V20" />
    <circle cx="12" cy="9.5" r="1.6" />
    <path d="M12 11v2" />
  </Svg>
)

export const KeyIcon = ({ size }) => (
  <Svg size={size}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12 20 3" />
    <path d="M17 6l3 3M14 9l2 2" />
  </Svg>
)

export const MoonIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M20 13.5A8 8 0 1 1 10.5 4 6.5 6.5 0 0 0 20 13.5Z" />
  </Svg>
)

export const CoffeeIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M4 9h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9Z" />
    <path d="M17 10h2a2 2 0 0 1 0 4h-2" />
    <path d="M7 6c0-1 .8-1.5.8-1.5S8.5 4 8.5 3" />
    <path d="M11 6c0-1 .8-1.5.8-1.5S12.5 4 12.5 3" />
  </Svg>
)

export const StarIcon = ({ size }) => (
  <Svg size={size}>
    <path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17l-5.4 2.8 1.1-6.1L3.2 9.4l6.1-.8L12 3Z" />
  </Svg>
)

// 彩色云朵形状（多个天气图标复用）
const CloudShape = ({ color = '#90A4AE' }) => (
  <g fill={color}>
    <circle cx="23" cy="41" r="11" />
    <circle cx="36" cy="35" r="13" />
    <circle cx="48" cy="42" r="9" />
    <rect x="23" y="38" width="25" height="13" rx="6.5" />
  </g>
)

export const SunIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <g stroke="#FFB300" strokeWidth="4" strokeLinecap="round">
      <path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M49 15l-6 6M21 43l-6 6" />
    </g>
    <circle cx="32" cy="32" r="13" fill="#FFC107" />
  </svg>
)

export const CloudSunIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <circle cx="25" cy="25" r="9" fill="#FFC107" />
    <g stroke="#FFB300" strokeWidth="3" strokeLinecap="round">
      <path d="M25 11v5M25 34v5M11 25h5M34 25h5" />
    </g>
    <CloudShape color="#B0BEC5" />
  </svg>
)

export const CloudIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <CloudShape color="#90A4AE" />
  </svg>
)

export const RainIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <CloudShape color="#78909C" />
    <g fill="#29B6F6">
      <rect x="27" y="46" width="4" height="8" rx="2">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="1s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1; 0; 1" dur="1s" repeatCount="indefinite" />
      </rect>
      <rect x="37" y="46" width="4" height="8" rx="2">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="1s" begin="0.33s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1; 0; 1" dur="1s" begin="0.33s" repeatCount="indefinite" />
      </rect>
      <rect x="47" y="46" width="4" height="8" rx="2">
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="1s" begin="0.66s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1; 0; 1" dur="1s" begin="0.66s" repeatCount="indefinite" />
      </rect>
    </g>
  </svg>
)

export const SnowIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <CloudShape color="#90A4AE" />
    <g stroke="#E1F5FE" strokeWidth="3" strokeLinecap="round">
      <g>
        <path d="M28 46v8M24 50h8" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1; 0.4; 1" dur="1.4s" repeatCount="indefinite" />
      </g>
      <g>
        <path d="M40 46v8M36 50h8" />
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 6; 0 0" dur="1.4s" begin="0.7s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1; 0.4; 1" dur="1.4s" begin="0.7s" repeatCount="indefinite" />
      </g>
    </g>
  </svg>
)

export const StormIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <CloudShape color="#546E7A" />
    <path d="M33 30 L23 44 h8 L28 54 L43 39 h-8 Z" fill="#FFC107" />
  </svg>
)

export const FogIcon = ({ size, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" {...props}>
    <CloudShape color="#90A4AE" />
    <g stroke="#B0BEC5" strokeWidth="3" strokeLinecap="round">
      <path d="M18 52h28" />
      <path d="M24 57h18" />
    </g>
  </svg>
)

export const WEATHER_ICONS = {
  sunny: SunIcon,
  cloudy: CloudSunIcon,
  overcast: CloudIcon,
  rain: RainIcon,
  snow: SnowIcon,
  storm: StormIcon,
  fog: FogIcon,
}
