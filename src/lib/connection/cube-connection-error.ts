export function classifyCubeConnectionError(message: string) {
  if (/Unable to determine cube MAC address/i.test(message)) return "mac";
  if (/不支持 Web Bluetooth/.test(message)) return "unsupported";
  if (/安全上下文/.test(message)) return "insecure";
  if (/NotFoundError|User cancelled|No device selected/i.test(message)) return "selection";
  if (/SecurityError|NotAllowedError|permission|access denied/i.test(message)) return "permission";
  if (/unsupported cube|wrong or unsupported|Can't find target BLE services/i.test(message)) return "device";
  if (/NetworkError|GATT|startNotifications|Bluetooth.*(connect|service)/i.test(message)) return "bluetooth";
  return "unknown";
}
