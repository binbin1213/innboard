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

export const SunIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const CloudSunIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M16.5 7.5a3.5 3.5 0 1 0-1.2 6.8" />
    <path d="M7 18h9.5a3.5 3.5 0 1 0-.6-6.96A4.5 4.5 0 0 0 7.4 13 3 3 0 0 0 7 18Z" />
  </Svg>
)

export const CloudIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M7 18h10a4 4 0 0 0 .7-7.95A5.5 5.5 0 0 0 7.1 13 3.5 3.5 0 0 0 7 18Z" />
  </Svg>
)

export const RainIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M7 15h10a4 4 0 0 0 .7-7.95A5.5 5.5 0 0 0 7.1 10 3.5 3.5 0 0 0 7 15Z" />
    <path d="M9 18l-1 2">
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1; 0; 1" dur="1s" repeatCount="indefinite" />
    </path>
    <path d="M13 18l-1 2">
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1s" begin="0.33s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1; 0; 1" dur="1s" begin="0.33s" repeatCount="indefinite" />
    </path>
    <path d="M17 18l-1 2">
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1s" begin="0.66s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1; 0; 1" dur="1s" begin="0.66s" repeatCount="indefinite" />
    </path>
  </Svg>
)

export const SnowIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M7 14h10a4 4 0 0 0 .7-7.95A5.5 5.5 0 0 0 7.1 9 3.5 3.5 0 0 0 7 14Z" />
    <g>
      <path d="M9 17v3M7.5 18.5h3" />
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1.4s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1; 0.4; 1" dur="1.4s" repeatCount="indefinite" />
    </g>
    <g>
      <path d="M16 17v3M14.5 18.5h3" />
      <animateTransform attributeName="transform" type="translate" values="0 0; 0 4; 0 0" dur="1.4s" begin="0.7s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="1; 0.4; 1" dur="1.4s" begin="0.7s" repeatCount="indefinite" />
    </g>
  </Svg>
)

export const StormIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M7 13h9.5a3.5 3.5 0 0 0 .6-6.96A5 5 0 0 0 7.4 8.5 3.5 3.5 0 0 0 7 13Z" />
    <path d="M12 13l-2.5 4h4L11 21" />
  </Svg>
)

export const FogIcon = ({ size, ...props }) => (
  <Svg size={size} {...props}>
    <path d="M7 12h11a3.5 3.5 0 0 0 .6-6.96A5 5 0 0 0 7.2 7.5 3.5 3.5 0 0 0 7 12Z" />
    <path d="M5 16h14M7 19h10" />
  </Svg>
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
