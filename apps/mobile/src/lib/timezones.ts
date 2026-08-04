/**
 * A curated span of IANA zones — not the full ~400-zone database, just enough
 * to cover every UTC offset a circle is likely to span. The device's actual
 * zone is always added if it isn't already in this list (see TimezoneScreen).
 */
export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: 'Pacific/Midway', label: 'Midway / American Samoa' },
  { value: 'Pacific/Honolulu', label: 'Honolulu' },
  { value: 'America/Anchorage', label: 'Anchorage' },
  { value: 'America/Los_Angeles', label: 'Los Angeles / Seattle' },
  { value: 'America/Denver', label: 'Denver / Phoenix' },
  { value: 'America/Chicago', label: 'Chicago / Dallas' },
  { value: 'America/New_York', label: 'New York / Toronto' },
  { value: 'America/Halifax', label: 'Halifax' },
  { value: 'America/Sao_Paulo', label: 'São Paulo' },
  { value: 'Atlantic/Reykjavik', label: 'Reykjavik' },
  { value: 'Europe/London', label: 'London / Dublin' },
  { value: 'Europe/Paris', label: 'Paris / Berlin / Madrid' },
  { value: 'Europe/Athens', label: 'Athens / Helsinki' },
  { value: 'Europe/Moscow', label: 'Moscow' },
  { value: 'Africa/Lagos', label: 'Lagos' },
  { value: 'Africa/Cairo', label: 'Cairo' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Asia/Karachi', label: 'Karachi' },
  { value: 'Asia/Kolkata', label: 'Mumbai / New Delhi' },
  { value: 'Asia/Dhaka', label: 'Dhaka' },
  { value: 'Asia/Bangkok', label: 'Bangkok / Jakarta' },
  { value: 'Asia/Shanghai', label: 'Beijing / Shanghai / Singapore' },
  { value: 'Asia/Tokyo', label: 'Tokyo / Seoul' },
  { value: 'Australia/Perth', label: 'Perth' },
  { value: 'Australia/Sydney', label: 'Sydney / Melbourne' },
  { value: 'Pacific/Auckland', label: 'Auckland' },
];

/** The curated list, plus `current` prepended if it isn't already in it. */
export function timezoneOptions(current: string): TimezoneOption[] {
  if (TIMEZONES.some((z) => z.value === current)) return TIMEZONES;
  return [{ value: current, label: current }, ...TIMEZONES];
}

export function labelForTimezone(value: string, options: TimezoneOption[]): string {
  return options.find((z) => z.value === value)?.label ?? value;
}
