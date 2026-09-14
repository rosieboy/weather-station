export const conditions: Record<string, [string, string]> = {
  sunny: ['☀', 'Soligt'],
  'clear-night': ['☾', 'Klart'],
  cloudy: ['☁', 'Mulet'],
  partlycloudy: ['⛅', 'Växlande molnighet'],
  rainy: ['☂', 'Regn'],
  pouring: ['☂', 'Kraftigt regn'],
  snowy: ['❄', 'Snö'],
  'snowy-rainy': ['❄', 'Snöblandat regn'],
  fog: ['≋', 'Dimma'],
  windy: ['≋', 'Blåsigt'],
  'windy-variant': ['≋', 'Blåsigt och mulet'],
  lightning: ['ϟ', 'Åska'],
  'lightning-rainy': ['ϟ', 'Regn och åska'],
  hail: ['❄', 'Hagel'],
  exceptional: ['!', 'Avvikande väder']
};
export const moons: Record<string, [string, string]> = {
  new_moon: ['🌑', 'Nymåne'],
  waxing_crescent: ['🌒', 'Tilltagande skära'],
  first_quarter: ['🌓', 'Första kvarteret'],
  waxing_gibbous: ['🌔', 'Tilltagande måne'],
  full_moon: ['🌕', 'Fullmåne'],
  waning_gibbous: ['🌖', 'Avtagande måne'],
  last_quarter: ['🌗', 'Sista kvarteret'],
  waning_crescent: ['🌘', 'Avtagande skära']
};
