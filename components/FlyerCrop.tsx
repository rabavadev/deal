import type { CropRect } from '@/lib/types'

export function FlyerCrop({ crop, alt }: { crop: CropRect; alt: string }) {
  const posX = crop.w < 100 ? (crop.x / (100 - crop.w)) * 100 : 0
  const posY = crop.h < 100 ? (crop.y / (100 - crop.h)) * 100 : 0
  return (
    <div
      role="img" aria-label={alt}
      className="w-full rounded-lg bg-white"
      style={{
        aspectRatio: `${crop.w} / ${crop.h}`,
        backgroundImage: `url(${crop.image})`,
        backgroundSize: `${10000 / crop.w}% auto`,
        backgroundPosition: `${posX}% ${posY}%`,
      }}
    />
  )
}
