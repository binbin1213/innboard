import { Fragment, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import {
  BedIcon,
  TwinIcon,
  FamilyIcon,
  KeyIcon,
  MoonIcon,
  CoffeeIcon,
  StarIcon,
  HotelIcon,
} from '../components/Icons'

const STAGE_W = 1080
const STAGE_H = 1920
const POLL_MS = 30_000
// 电视过扫描安全间距(px)：电视机会对边缘做 5%-8% 放大切边，
// 外层留出安全 padding，保证核心文字(时间/日期/公告)在放大后仍在可视区
const SAFE_PAD = 48

function formatPrice(price) {
  return Number.isInteger(price) ? String(price) : price.toFixed(1)
}

function roomIcon(name) {
  if (/双床|双人/.test(name)) return TwinIcon
  if (/家庭|亲子/.test(name)) return FamilyIcon
  return BedIcon
}

function announcementIcon(text) {
  if (/入住|退房/.test(text)) return KeyIcon
  if (/早餐|餐/.test(text)) return CoffeeIcon
  if (/夜|晚/.test(text)) return MoonIcon
  return StarIcon
}

function RoomCard({ room, flashed }) {
  const Icon = roomIcon(room.name)
  const saving = room.rack_price - room.member_price
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E8C872]/15 bg-[#E8C872]/[0.03] backdrop-blur-sm px-8 py-4">
      <div className="flex items-center gap-5 min-w-0">
        <Icon size={40} className="text-[#E8C872] shrink-0" />
        <div className="min-w-0">
          <div className="text-[32px] leading-tight">{room.name}</div>
          {room.description && (
            <div className="text-[21px] text-gray-400 mt-1">
              {room.description}
              {!room.sold_out && room.remaining_rooms != null && room.remaining_rooms > 0 && (
                <span className="text-red-400 ml-4">仅剩 {room.remaining_rooms} 间</span>
              )}
            </div>
          )}
        </div>
      </div>
      {room.sold_out ? (
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-4 opacity-50">
            <span className="text-[24px] text-gray-500 line-through tabular-nums">
              ¥{formatPrice(room.rack_price)}
            </span>
            <span className="text-[21px] px-3.5 py-1 rounded-full bg-gray-600 text-gray-300 font-semibold">
              会员专享
            </span>
            <span className="text-[56px] font-bold text-gray-400 line-through tabular-nums leading-none">
              ¥{formatPrice(room.member_price)}
            </span>
          </div>
          <span className="text-[38px] font-bold text-red-400 w-[110px] text-center">满房</span>
        </div>
      ) : (
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[24px] text-gray-500 line-through tabular-nums">
            ¥{formatPrice(room.rack_price)}
          </span>
          <span className="text-[21px] px-3.5 py-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E8C872] text-[#1a1405] font-semibold">
            会员专享
          </span>
          <span
            className={`text-[56px] font-bold text-[#E8C872] tabular-nums leading-none ${
              flashed ? 'price-flash' : ''
            }`}
          >
            ¥{formatPrice(room.member_price)}
          </span>
          {saving > 0 && (
            <span className="text-[20px] px-3 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold w-[110px] text-center">
              省 ¥{formatPrice(saving)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// 欢迎致辞横幅：优先显示，覆盖图片轮播区
// 支持：文字（主标题/副标题/落款）自由填写 + 可选背景图（文字叠加在图上）
// 布局：文字撑满整个横幅，四周只留少量边距；长文本自动降字号防溢出
function WelcomeBanner({ welcome, hotelName }) {
  const { title, subtitle, message, image_url } = welcome
  // 按字数自适应字号：越短越大，长文本自动降级避免换行溢出
  const titleFont = title.length > 10 ? 92 : title.length > 6 ? 108 : 126
  const subtitleFont = subtitle.length > 12 ? 68 : subtitle.length > 8 ? 80 : 96
  const messageFont = message.length > 24 ? 36 : message.length > 14 ? 42 : 50
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 背景：有图用图，无图用金色渐变 */}
      {image_url ? (
        <img src={image_url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220] via-[#0d1a30] to-[#1a2b4a]" />
      )}
      {/* 半透明遮罩：保证文字在图片上清晰可读 */}
      <div className="absolute inset-0 bg-black/40" />

      {/* 内容区：撑满全高，四周只留少量边距 */}
      <div className="absolute inset-0 flex flex-col items-center px-10 pt-5 pb-4">
        {/* 顶部小标：WELCOME */}
        <div className="shrink-0 flex items-center gap-5">
          <div className="h-[2px] w-20 bg-[#D4AF37]/70" />
          <span className="text-[32px] text-[#D4AF37] tracking-[0.6em] pl-[0.6em] font-medium">
            WELCOME
          </span>
          <div className="h-[2px] w-20 bg-[#D4AF37]/70" />
        </div>

        {/* 中间文字区：垂直占满剩余高度 */}
        <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center text-center">
          {title && (
            <div
              className="leading-tight w-full"
              style={{
                fontFamily: '"Source Han Serif SC", "思源宋体", "Noto Serif SC", serif',
                fontSize: titleFont,
                fontWeight: 900,
                letterSpacing: 8,
                color: '#E8C872',
                textShadow: '0 4px 24px rgba(0,0,0,0.55)',
              }}
            >
              {title}
            </div>
          )}
          {subtitle && (
            <div
              className="mt-4 w-full"
              style={{
                fontSize: subtitleFont,
                fontWeight: 900,
                letterSpacing: 6,
                color: '#DE2910',
                textShadow: '0 3px 18px rgba(0,0,0,0.6)',
              }}
            >
              {subtitle}
            </div>
          )}
          {message && (
            <div
              className="mt-3 w-full"
              style={{
                fontSize: messageFont,
                letterSpacing: 3,
                color: 'rgba(255,255,255,0.92)',
                textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              }}
            >
              {message}
            </div>
          )}
        </div>

        {/* 底部落款：酒店名，右下角 */}
        {hotelName && (
          <div className="shrink-0 w-full flex justify-end pr-3">
            <div
              className="text-[40px]"
              style={{ color: 'rgba(232,200,114,0.85)', letterSpacing: 4 }}
            >
              {hotelName}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Display() {
  const [data, setData] = useState(null)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(new Date())
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [scale, setScale] = useState(1)
  const [flashed, setFlashed] = useState({})
  const loadedRef = useRef(new Set())
  const prevPricesRef = useRef({})

  useEffect(() => {
    const onResize = () => {
      // 可用区域 = 视口减去两侧安全边距，保证缩放后舞台整体在安全区内
      const availW = Math.max(1, window.innerWidth - SAFE_PAD * 2)
      const availH = Math.max(1, window.innerHeight - SAFE_PAD * 2)
      setScale(Math.min(availW / STAGE_W, availH / STAGE_H))
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fetchData = async () => {
    try {
      const res = await api.get('/api/display')
      setData(res)
      setOffset(new Date(res.server_time).getTime() - Date.now())
      const prev = prevPricesRef.current
      const next = {}
      const changed = {}
      res.rooms.forEach((r) => {
        if (prev[r.name] !== undefined && prev[r.name] !== r.member_price) changed[r.name] = true
        next[r.name] = r.member_price
      })
      prevPricesRef.current = next
      if (Object.keys(changed).length) {
        setFlashed(changed)
        setTimeout(() => setFlashed({}), 2600)
      }
    } catch {
      // 拉取失败时静默保留上一次数据继续显示，不向客人展示任何提示
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date(Date.now() + offset)), 1000)
    return () => clearInterval(timer)
  }, [offset])

  const images = data?.images || []
  const interval = Math.max(3, data?.carousel_interval || 5)
  const welcome = data?.welcome || {}

  useEffect(() => {
    if (images.length === 0) return
    images.forEach((url) => {
      if (loadedRef.current.has(url)) return
      loadedRef.current.add(url)
      const img = new Image()
      img.src = url
    })
  }, [images])

  // 轮播仅在无欢迎致辞时运行
  useEffect(() => {
    if (images.length === 0 || welcome.enabled) return
    const timer = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % images.length)
    }, interval * 1000)
    return () => clearInterval(timer)
  }, [images, interval, welcome.enabled])

  if (!data) {
    return <div className="h-full w-full bg-black" />
  }

  const dateText = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const weekdayText = now.toLocaleDateString('zh-CN', { weekday: 'long' })
  const timeParts = now.toLocaleTimeString('zh-CN', { hour12: false }).split(':')
  const hhmm = `${timeParts[0]}:${timeParts[1]}`

  return (
    <div
      className="h-full w-full bg-black flex flex-col overflow-hidden"
      style={{ padding: SAFE_PAD }}
    >
      {/* 弹性撑满可用高度：舞台垂直居中，避免因 TV 放大而溢出底部 */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div
          className="relative shrink-0 bg-gradient-to-b from-[#080f1c] via-[#0b1220] to-[#141f36] text-white overflow-hidden select-none"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
        >
          {/* 顶部安全渐变遮罩：TV 过扫描裁切时保护顶部文字（时间/日期） */}
          <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-black/60 via-black/25 to-transparent pointer-events-none z-20" />

          <div className="relative flex flex-col h-full">
            {/* 顶部信息栏（方案A：品牌 | 天气 | 时间） */}
            <header
              className="shrink-0 flex items-center"
              style={{
                height: 132,
                paddingLeft: 40,
                paddingRight: 50,
                background:
                  'linear-gradient(90deg, #020B18 0%, #04152B 40%, #061B34 70%, #020B18 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {/* 品牌区：Logo + 酒店名称 */}
              <div className="flex items-center gap-6 shrink-0">
                {data.logo_url ? (
                  <img
                    src={data.logo_url}
                    alt="logo"
                    className="object-contain shrink-0"
                    style={{ height: 68, opacity: 0.9 }}
                  />
                ) : (
                  <HotelIcon size={68} className="text-[#D8B56A] shrink-0" />
                )}
                <div className="flex flex-col items-center justify-center min-w-0">
                  <h1
                    className="truncate leading-none"
                    style={{
                      fontFamily: '"Source Han Serif SC", "思源宋体", "Noto Serif SC", serif',
                      fontWeight: 700,
                      fontSize: 48,
                      color: '#D8B56A',
                      letterSpacing: 2,
                    }}
                  >
                    {data.hotel_name}
                  </h1>
                  <div
                    className="leading-none mt-3"
                    style={{
                      fontSize: 15,
                      color: 'rgba(216,181,106,0.9)',
                      letterSpacing: 3,
                    }}
                  >
                    BIWY HOTEL
                  </div>
                </div>
              </div>

              {/* 分隔线 */}
              <div
                style={{
                  width: 1,
                  height: 56,
                  background: 'rgba(255,255,255,0.25)',
                  marginLeft: 36,
                  marginRight: 36,
                }}
              />

              {/* 天气：在剩余空间居中 */}
              <div
                className="flex-1"
                style={{
                  fontSize: 26,
                  color: 'rgba(255,255,255,0.9)',
                  letterSpacing: 1,
                  textAlign: 'center',
                }}
              >
                {data.weather_city && data.weather
                  ? `${data.weather_city} · ${data.weather.text} ${data.weather.temp}℃`
                  : data.weather_city || ''}
              </div>

              {/* 时间区：日期 + 时间（无秒） */}
              <div className="flex flex-col items-end shrink-0">
                <div style={{ fontSize: 24, color: 'rgba(255,255,255,0.75)' }}>
                  {dateText} {weekdayText}
                </div>
                <div
                  className="font-bold leading-tight tabular-nums"
                  style={{
                    fontFamily: '"DIN", "DIN Alternate", "Roboto", sans-serif',
                    fontWeight: 700,
                    fontSize: 52,
                    color: '#FFFFFF',
                  }}
                >
                  {hhmm}
                </div>
              </div>
            </header>

            {/* 横版图片轮播（16:9 条幅）—— 欢迎致辞优先 */}
            <div className="relative mx-10 mt-5 h-[565px] shrink-0 rounded-2xl overflow-hidden bg-[#111a2e]">
              {welcome.enabled ? (
                <WelcomeBanner welcome={welcome} hotelName={data.hotel_name} />
              ) : images.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-[48px] text-[#D4AF37] font-bold">{data.hotel_name}</div>
                    <div className="text-[28px] text-gray-400 mt-4">请在管理后台上传宣传图片</div>
                  </div>
                </div>
              ) : (
                images.map((url, i) => (
                  <img
                    key={url}
                    src={url}
                    alt=""
                    draggable={false}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                      i === carouselIndex ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))
              )}
              {/* 顶部渐变：让大图与头部平滑过渡，裁切处不显生硬 */}
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />
            </div>

            {/* 房价牌区域（防烧屏位移） */}
            <main className="burnin-shift flex-1 px-10 pt-4 flex flex-col min-h-0">
              <div className="flex-1 min-h-0 flex flex-col justify-center">
                <div className="shrink-0 pb-3 relative flex flex-col items-center">
                  <div className="flex items-center gap-5">
                    <div className="h-[2px] w-52 bg-gradient-to-l from-[#D4AF37]/60 to-transparent" />
                    <div className="w-2 h-2 rotate-45 bg-[#D4AF37]/70 shrink-0" />
                    <h2 className="text-[52px] font-bold text-[#D4AF37] leading-none tracking-[0.3em] pl-[0.3em]">
                      今日房价
                    </h2>
                    <div className="w-2 h-2 rotate-45 bg-[#D4AF37]/70 shrink-0" />
                    <div className="h-[2px] w-52 bg-gradient-to-r from-[#D4AF37]/60 to-transparent" />
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex flex-col gap-6 pb-2">
                {data.rooms.map((room) => (
                  <RoomCard key={room.name} room={room} flashed={!!flashed[room.name]} />
                ))}
              </div>
            </main>

            {/* 公告条 + 二维码 */}
            <footer className="burnin-shift shrink-0 px-10 pb-8 pt-2">
              <div className="flex items-center gap-8 border-t border-[#E8C872]/15 pt-4">
                <div className="flex-1 flex items-center justify-around">
                  {data.announcements.map((text, i) => {
                    const AIcon = announcementIcon(text)
                    return (
                      <Fragment key={text}>
                        {i > 0 && <div className="h-10 w-px bg-[#E8C872]/15" />}
                        <div className="flex items-center gap-3 text-[24px] text-gray-300">
                          <AIcon size={30} className="text-[#E8C872] shrink-0" />
                          <span>{text}</span>
                        </div>
                      </Fragment>
                    )
                  })}
                </div>
                {data.qr_url && (
                  <div className="flex flex-col items-center shrink-0">
                    <img
                      src={data.qr_url}
                      alt="二维码"
                      className="h-[130px] w-[130px] rounded-lg bg-white p-1.5 object-contain"
                    />
                    <span className="text-[20px] text-[#E8C872] mt-1.5">扫码订房</span>
                  </div>
                )}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}
