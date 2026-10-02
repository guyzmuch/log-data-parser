/** Whether `timeZone` is an identifier Intl accepts (an IANA name like "Europe/Paris"). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
