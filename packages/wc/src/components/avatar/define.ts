import { defineElement } from "../../internal/define.js"
import {
  TecAvatar,
  TecAvatarBadge,
  TecAvatarFallback,
  TecAvatarGroup,
  TecAvatarGroupCount,
  TecAvatarImage,
} from "./avatar.js"

defineElement("tec-avatar-group", TecAvatarGroup)
defineElement("tec-avatar", TecAvatar)
defineElement("tec-avatar-image", TecAvatarImage)
defineElement("tec-avatar-fallback", TecAvatarFallback)
defineElement("tec-avatar-badge", TecAvatarBadge)
defineElement("tec-avatar-group-count", TecAvatarGroupCount)

export { TecAvatar, TecAvatarBadge, TecAvatarFallback, TecAvatarGroup, TecAvatarGroupCount, TecAvatarImage }
