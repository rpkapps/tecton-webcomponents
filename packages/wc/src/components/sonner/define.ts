import { defineElement } from "../../internal/define.js"
import { toast } from "./toast.js"
import { TecToaster } from "./toaster.js"

defineElement("tec-toaster", TecToaster)

export { TecToaster, toast }
export type { PromiseOptions, ToastAction, ToastContent, ToastData, ToastId, ToastOptions, ToastPosition, ToastType } from "./toast.js"
