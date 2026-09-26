import { defineElement } from "../../internal/define.js"
import { TecInputOtp, TecInputOtpGroup, TecInputOtpSeparator, TecInputOtpSlot } from "./input-otp.js"

// The OTP input provides context to its groups and slots: define it first.
defineElement("tec-input-otp", TecInputOtp)
defineElement("tec-input-otp-group", TecInputOtpGroup)
defineElement("tec-input-otp-slot", TecInputOtpSlot)
defineElement("tec-input-otp-separator", TecInputOtpSeparator)

export { TecInputOtp, TecInputOtpGroup, TecInputOtpSeparator, TecInputOtpSlot }
