import { defineElement } from "../../internal/define.js"
import "../button/define.js"
import { TecCarousel } from "./carousel.js"
import { TecCarouselContent } from "./carousel-content.js"
import { TecCarouselAutoplayToggle, TecCarouselNext, TecCarouselPrevious } from "./carousel-controls.js"
import { TecCarouselItem } from "./carousel-item.js"

defineElement("tec-carousel", TecCarousel)
defineElement("tec-carousel-content", TecCarouselContent)
defineElement("tec-carousel-item", TecCarouselItem)
defineElement("tec-carousel-previous", TecCarouselPrevious)
defineElement("tec-carousel-next", TecCarouselNext)
defineElement("tec-carousel-autoplay-toggle", TecCarouselAutoplayToggle)

export { TecCarousel, TecCarouselAutoplayToggle, TecCarouselContent, TecCarouselItem, TecCarouselNext, TecCarouselPrevious }
