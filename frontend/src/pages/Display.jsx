import { Fragment, useEffect, useRef, useState } from 'react'
import { api } from '../api'
import {
  WEATHER_ICONS,
  CloudIcon,
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
    <div className="flex items-center justify-between rounded-xl border border-[#211F1B]/10 bg-white/50 backdrop-blur-sm px-8 py-4">
      <div className="flex items-center gap-5 min-w-0">
        <Icon size={40} className="text-[#334B42] shrink-0" />
        <div className="min-w-0">
          <div className="text-[32px] leading-tight">{room.name}</div>
          {room.description && (
            <div className="text-[21px] text-[#211F1B]/50 mt-1">
              {room.description}
              {room.remaining_rooms != null && room.remaining_rooms > 0 && (
                <span className="text-[#A1804A] ml-4">仅剩 {room.remaining_rooms} 间</span>
              )}
            </div>
          )}
        </div>
      </div>
      {room.sold_out ? (
        <span className="text-[38px] font-bold text-[#B05A45]">满房</span>
      ) : (
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-[24px] text-[#211F1B]/40 line-through tabular-nums">
            ¥{formatPrice(room.rack_price)}
          </span>
          <span className="text-[21px] px-3.5 py-1 rounded-full bg-[#334B42] text-white font-semibold">
            会员专享
          </span>
          <span
            className={`text-[56px] font-bold text-[#334B42] tabular-nums leading-none ${
              flashed ? 'price-flash' : ''
            }`}
          >
            ¥{formatPrice(room.member_price)}
          </span>
          {saving > 0 && (
            <span className="text-[20px] px-3 py-1 rounded-full bg-[#A1804A] text-white font-semibold">
              省 ¥{formatPrice(saving)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function Display() {
  const [data, setData] = useState(null)
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(new Date())
  const [carouselIndex, setCarouselIndex] = useState(0)
  const [offline, setOffline] = useState(false)
  const [scale, setScale] = useState(1)
  const [flashed, setFlashed] = useState({})
  const lastFetchRef = useRef(null)
  const loadedRef = useRef(new Set())
  const prevPricesRef = useRef({})

  useEffect(() => {
    const onResize = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fetchData = async () => {
    try {
      const res = await api.get('/api/display')
      setData(res)
      setOffline(false)
      lastFetchRef.current = new Date()
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
      setOffline(true)
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

  useEffect(() => {
    if (images.length === 0) return
    images.forEach((url) => {
      if (loadedRef.current.has(url)) return
      loadedRef.current.add(url)
      const img = new Image()
      img.src = url
    })
  }, [images])

  useEffect(() => {
    if (images.length === 0) return
    const timer = setInterval(() => {
      setCarouselIndex((i) => (i + 1) % images.length)
    }, interval * 1000)
    return () => clearInterval(timer)
  }, [images, interval])

  if (!data) {
    return <div className="h-screen w-screen bg-[#EBE6DC]" />
  }

  const dateText = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const weekdayText = now.toLocaleDateString('zh-CN', { weekday: 'long' })
  const timeParts = now.toLocaleTimeString('zh-CN', { hour12: false }).split(':')
  const hhmm = `${timeParts[0]}:${timeParts[1]}`
  const ss = timeParts[2] || '00'
  const lastFetchText = lastFetchRef.current
    ? lastFetchRef.current.toLocaleTimeString('zh-CN', { hour12: false })
    : '--:--:--'
  const WeatherGlyph = data.weather ? WEATHER_ICONS[data.weather.cat] || CloudIcon : null

  return (
    <div className="h-screen w-screen bg-[#EBE6DC] flex items-center justify-center overflow-hidden">
      <div
        className="relative shrink-0 bg-gradient-to-b from-[#FBF9F5] via-[#F6F4F0] to-[#F1ECE3] text-[#211F1B] overflow-hidden select-none"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        <div className="relative flex flex-col h-full">
          {/* 顶部：酒店名 + 天气（居中）+ 时间 */}
          <header className="relative flex items-center justify-between px-10 pt-7 pb-5 shrink-0 border-b border-[#211F1B]/10">
            <div className="flex items-center gap-4 min-w-0">
              {data.logo_url ? (
                <img src={data.logo_url} alt="logo" className="h-[72px] w-[72px] object-contain" />
              ) : (
                <HotelIcon size={56} className="text-[#334B42] shrink-0" />
              )}
              <h1 className="text-[46px] font-bold tracking-wider text-[#334B42] truncate">
                {data.hotel_name}
              </h1>
            </div>
            {data.weather_city && (
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
                <span className="text-[28px] text-[#211F1B]/60">{data.weather_city}</span>
                {data.weather ? (
                  <>
                    <WeatherGlyph size={40} className="text-[#334B42]" />
                    <span className="text-[34px] font-medium text-[#334B42]">
                      {data.weather.text} {data.weather.temp}℃
                    </span>
                  </>
                ) : (
                  <span className="text-[24px] text-[#211F1B]/40">天气未配置</span>
                )}
              </div>
            )}
            <div className="flex flex-col items-end shrink-0">
              <div className="text-[26px] text-[#211F1B]/60">
                {dateText} {weekdayText}
              </div>
              <div className="text-[72px] font-bold leading-tight tabular-nums">
                {hhmm}
                <span key={ss} className="animate-sec-fade text-[#A1804A]">
                  :{ss}
                </span>
              </div>
            </div>
          </header>

          {/* 横版图片轮播（16:9 条幅） */}
          <div className="relative mx-10 mt-5 h-[565px] shrink-0 rounded-2xl overflow-hidden bg-[#EFEBE2]">
            {images.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-[48px] text-[#334B42] font-bold">{data.hotel_name}</div>
                  <div className="text-[28px] text-[#211F1B]/40 mt-4">请在管理后台上传宣传图片</div>
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
          </div>

          {/* 房价牌区域（防烧屏位移） */}
          <main className="burnin-shift flex-1 px-10 pt-4 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 flex flex-col justify-center">
              <div className="shrink-0 pb-3 relative flex flex-col items-center">
                <div className="flex items-center gap-5">
                  <div className="h-[2px] w-52 bg-gradient-to-l from-[#334B42]/40 to-transparent" />
                  <div className="w-2 h-2 rotate-45 bg-[#334B42]/50 shrink-0" />
                  <h2 className="text-[52px] font-bold text-[#334B42] leading-none tracking-[0.3em] pl-[0.3em]">
                    今日房价
                  </h2>
                  <div className="w-2 h-2 rotate-45 bg-[#334B42]/50 shrink-0" />
                  <div className="h-[2px] w-52 bg-gradient-to-r from-[#334B42]/40 to-transparent" />
                </div>
                <div className="absolute right-0 bottom-1 flex items-center gap-3 text-[20px] text-[#211F1B]/40">
                  {offline && <span className="text-[#B05A45]">网络中断，显示缓存数据</span>}
                  <span>更新时间 {lastFetchText}</span>
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
          <footer className="burnin-shift shrink-0 px-10 pb-6 pt-2">
            <div className="flex items-center gap-8 border-t border-[#211F1B]/10 pt-4">
              <div className="flex-1 flex items-center justify-around">
                {data.announcements.map((text, i) => {
                  const AIcon = announcementIcon(text)
                  return (
                    <Fragment key={text}>
                      {i > 0 && <div className="h-10 w-px bg-[#211F1B]/10" />}
                      <div className="flex items-center gap-3 text-[24px] text-[#211F1B]/70">
                        <AIcon size={30} className="text-[#334B42] shrink-0" />
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
                  <span className="text-[20px] text-[#334B42] mt-1.5">扫码订房</span>
                </div>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
