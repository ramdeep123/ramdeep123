// Crisis lines (handoff §9.1). VERIFY EVERY NUMBER BEFORE LAUNCH and on a
// schedule after (see docs/SAFETY.md). `checked` is the last date someone
// confirmed the line against the source.

export const CHECKED = '2026-10-09';

export const REGIONS = {
  IN: {
    name: 'India',
    emergency: '112',
    lines: [
      { name: 'Tele-MANAS (Govt. of India)', detail: 'Free, 24×7, many Indian languages', call: '14416', alt: '1-800-891-4416', source: 'https://telemanas.mohfw.gov.in' },
    ],
  },
  US: {
    name: 'United States',
    emergency: '911',
    lines: [
      { name: '988 Suicide & Crisis Lifeline', detail: 'Free, 24/7. Call or text 988', call: '988', text: '988', source: 'https://988lifeline.org' },
    ],
  },
  GB: {
    name: 'United Kingdom',
    emergency: '999',
    lines: [
      { name: 'Samaritans', detail: 'Free, 24/7, any phone', call: '116 123', source: 'https://www.samaritans.org' },
    ],
  },
  IE: {
    name: 'Ireland',
    emergency: '112',
    lines: [
      { name: 'Samaritans', detail: 'Free, 24/7, any phone', call: '116 123', source: 'https://www.samaritans.org' },
    ],
  },
  OTHER: {
    name: 'Another country',
    emergency: '',
    lines: [],
  },
};

export const DIRECTORY = { name: 'Find A Helpline', detail: 'Free, verified helplines in 130+ countries', url: 'https://findahelpline.com' };

/** Best guess of the user's region from the phone's time zone and language. */
export function guessRegion(tz = '', lang = '') {
  if (/Kolkata|Calcutta/.test(tz) || /-IN$/i.test(lang)) return 'IN';
  if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Indiana|Boise)|^Pacific\/Honolulu/.test(tz) || /-US$/i.test(lang)) return 'US';
  if (/Europe\/London/.test(tz) || /-GB$/i.test(lang)) return 'GB';
  if (/Europe\/Dublin/.test(tz) || /-IE$/i.test(lang)) return 'IE';
  return 'OTHER';
}

export const telHref = (n) => 'tel:' + String(n).replace(/[^\d+]/g, '');
export const smsHref = (n) => 'sms:' + String(n).replace(/[^\d+]/g, '');
