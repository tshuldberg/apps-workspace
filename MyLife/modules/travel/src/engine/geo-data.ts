/**
 * Static geographic reference data for MyTravel.
 *
 * All data is inline (no network, no filesystem reads). Country codes follow
 * ISO 3166-1 alpha-2. Continent codes: NA (North America), SA (South America),
 * EU (Europe), AS (Asia), AF (Africa), OC (Oceania), AN (Antarctica).
 */

export type ContinentCode = 'NA' | 'SA' | 'EU' | 'AS' | 'AF' | 'OC' | 'AN';

export interface Country {
  /** ISO 3166-1 alpha-2 code. */
  code: string;
  name: string;
  continent: ContinentCode;
  /** Coarse grouping used for UI filters (e.g. 'Americas', 'Europe'). */
  region: string;
}

export interface UsState {
  /** Two-letter US state (or DC) code. */
  code: string;
  name: string;
}

// ── Countries (ISO 3166-1 alpha-2, ~250 entries) ────────────────────

export const COUNTRIES: readonly Country[] = [
  { code: 'AD', name: 'Andorra', continent: 'EU', region: 'Europe' },
  { code: 'AE', name: 'United Arab Emirates', continent: 'AS', region: 'Middle East' },
  { code: 'AF', name: 'Afghanistan', continent: 'AS', region: 'Asia' },
  { code: 'AG', name: 'Antigua and Barbuda', continent: 'NA', region: 'Americas' },
  { code: 'AI', name: 'Anguilla', continent: 'NA', region: 'Americas' },
  { code: 'AL', name: 'Albania', continent: 'EU', region: 'Europe' },
  { code: 'AM', name: 'Armenia', continent: 'AS', region: 'Asia' },
  { code: 'AO', name: 'Angola', continent: 'AF', region: 'Africa' },
  { code: 'AQ', name: 'Antarctica', continent: 'AN', region: 'Antarctica' },
  { code: 'AR', name: 'Argentina', continent: 'SA', region: 'Americas' },
  { code: 'AS', name: 'American Samoa', continent: 'OC', region: 'Oceania' },
  { code: 'AT', name: 'Austria', continent: 'EU', region: 'Europe' },
  { code: 'AU', name: 'Australia', continent: 'OC', region: 'Oceania' },
  { code: 'AW', name: 'Aruba', continent: 'NA', region: 'Americas' },
  { code: 'AX', name: 'Åland Islands', continent: 'EU', region: 'Europe' },
  { code: 'AZ', name: 'Azerbaijan', continent: 'AS', region: 'Asia' },
  { code: 'BA', name: 'Bosnia and Herzegovina', continent: 'EU', region: 'Europe' },
  { code: 'BB', name: 'Barbados', continent: 'NA', region: 'Americas' },
  { code: 'BD', name: 'Bangladesh', continent: 'AS', region: 'Asia' },
  { code: 'BE', name: 'Belgium', continent: 'EU', region: 'Europe' },
  { code: 'BF', name: 'Burkina Faso', continent: 'AF', region: 'Africa' },
  { code: 'BG', name: 'Bulgaria', continent: 'EU', region: 'Europe' },
  { code: 'BH', name: 'Bahrain', continent: 'AS', region: 'Middle East' },
  { code: 'BI', name: 'Burundi', continent: 'AF', region: 'Africa' },
  { code: 'BJ', name: 'Benin', continent: 'AF', region: 'Africa' },
  { code: 'BL', name: 'Saint Barthélemy', continent: 'NA', region: 'Americas' },
  { code: 'BM', name: 'Bermuda', continent: 'NA', region: 'Americas' },
  { code: 'BN', name: 'Brunei', continent: 'AS', region: 'Asia' },
  { code: 'BO', name: 'Bolivia', continent: 'SA', region: 'Americas' },
  { code: 'BQ', name: 'Caribbean Netherlands', continent: 'NA', region: 'Americas' },
  { code: 'BR', name: 'Brazil', continent: 'SA', region: 'Americas' },
  { code: 'BS', name: 'Bahamas', continent: 'NA', region: 'Americas' },
  { code: 'BT', name: 'Bhutan', continent: 'AS', region: 'Asia' },
  { code: 'BV', name: 'Bouvet Island', continent: 'AN', region: 'Antarctica' },
  { code: 'BW', name: 'Botswana', continent: 'AF', region: 'Africa' },
  { code: 'BY', name: 'Belarus', continent: 'EU', region: 'Europe' },
  { code: 'BZ', name: 'Belize', continent: 'NA', region: 'Americas' },
  { code: 'CA', name: 'Canada', continent: 'NA', region: 'Americas' },
  { code: 'CC', name: 'Cocos (Keeling) Islands', continent: 'AS', region: 'Asia' },
  { code: 'CD', name: 'Democratic Republic of the Congo', continent: 'AF', region: 'Africa' },
  { code: 'CF', name: 'Central African Republic', continent: 'AF', region: 'Africa' },
  { code: 'CG', name: 'Republic of the Congo', continent: 'AF', region: 'Africa' },
  { code: 'CH', name: 'Switzerland', continent: 'EU', region: 'Europe' },
  { code: 'CI', name: "Côte d'Ivoire", continent: 'AF', region: 'Africa' },
  { code: 'CK', name: 'Cook Islands', continent: 'OC', region: 'Oceania' },
  { code: 'CL', name: 'Chile', continent: 'SA', region: 'Americas' },
  { code: 'CM', name: 'Cameroon', continent: 'AF', region: 'Africa' },
  { code: 'CN', name: 'China', continent: 'AS', region: 'Asia' },
  { code: 'CO', name: 'Colombia', continent: 'SA', region: 'Americas' },
  { code: 'CR', name: 'Costa Rica', continent: 'NA', region: 'Americas' },
  { code: 'CU', name: 'Cuba', continent: 'NA', region: 'Americas' },
  { code: 'CV', name: 'Cape Verde', continent: 'AF', region: 'Africa' },
  { code: 'CW', name: 'Curaçao', continent: 'NA', region: 'Americas' },
  { code: 'CX', name: 'Christmas Island', continent: 'AS', region: 'Asia' },
  { code: 'CY', name: 'Cyprus', continent: 'EU', region: 'Europe' },
  { code: 'CZ', name: 'Czechia', continent: 'EU', region: 'Europe' },
  { code: 'DE', name: 'Germany', continent: 'EU', region: 'Europe' },
  { code: 'DJ', name: 'Djibouti', continent: 'AF', region: 'Africa' },
  { code: 'DK', name: 'Denmark', continent: 'EU', region: 'Europe' },
  { code: 'DM', name: 'Dominica', continent: 'NA', region: 'Americas' },
  { code: 'DO', name: 'Dominican Republic', continent: 'NA', region: 'Americas' },
  { code: 'DZ', name: 'Algeria', continent: 'AF', region: 'Africa' },
  { code: 'EC', name: 'Ecuador', continent: 'SA', region: 'Americas' },
  { code: 'EE', name: 'Estonia', continent: 'EU', region: 'Europe' },
  { code: 'EG', name: 'Egypt', continent: 'AF', region: 'Africa' },
  { code: 'EH', name: 'Western Sahara', continent: 'AF', region: 'Africa' },
  { code: 'ER', name: 'Eritrea', continent: 'AF', region: 'Africa' },
  { code: 'ES', name: 'Spain', continent: 'EU', region: 'Europe' },
  { code: 'ET', name: 'Ethiopia', continent: 'AF', region: 'Africa' },
  { code: 'FI', name: 'Finland', continent: 'EU', region: 'Europe' },
  { code: 'FJ', name: 'Fiji', continent: 'OC', region: 'Oceania' },
  { code: 'FK', name: 'Falkland Islands', continent: 'SA', region: 'Americas' },
  { code: 'FM', name: 'Micronesia', continent: 'OC', region: 'Oceania' },
  { code: 'FO', name: 'Faroe Islands', continent: 'EU', region: 'Europe' },
  { code: 'FR', name: 'France', continent: 'EU', region: 'Europe' },
  { code: 'GA', name: 'Gabon', continent: 'AF', region: 'Africa' },
  { code: 'GB', name: 'United Kingdom', continent: 'EU', region: 'Europe' },
  { code: 'GD', name: 'Grenada', continent: 'NA', region: 'Americas' },
  { code: 'GE', name: 'Georgia', continent: 'AS', region: 'Asia' },
  { code: 'GF', name: 'French Guiana', continent: 'SA', region: 'Americas' },
  { code: 'GG', name: 'Guernsey', continent: 'EU', region: 'Europe' },
  { code: 'GH', name: 'Ghana', continent: 'AF', region: 'Africa' },
  { code: 'GI', name: 'Gibraltar', continent: 'EU', region: 'Europe' },
  { code: 'GL', name: 'Greenland', continent: 'NA', region: 'Americas' },
  { code: 'GM', name: 'Gambia', continent: 'AF', region: 'Africa' },
  { code: 'GN', name: 'Guinea', continent: 'AF', region: 'Africa' },
  { code: 'GP', name: 'Guadeloupe', continent: 'NA', region: 'Americas' },
  { code: 'GQ', name: 'Equatorial Guinea', continent: 'AF', region: 'Africa' },
  { code: 'GR', name: 'Greece', continent: 'EU', region: 'Europe' },
  { code: 'GS', name: 'South Georgia and the South Sandwich Islands', continent: 'AN', region: 'Antarctica' },
  { code: 'GT', name: 'Guatemala', continent: 'NA', region: 'Americas' },
  { code: 'GU', name: 'Guam', continent: 'OC', region: 'Oceania' },
  { code: 'GW', name: 'Guinea-Bissau', continent: 'AF', region: 'Africa' },
  { code: 'GY', name: 'Guyana', continent: 'SA', region: 'Americas' },
  { code: 'HK', name: 'Hong Kong', continent: 'AS', region: 'Asia' },
  { code: 'HM', name: 'Heard Island and McDonald Islands', continent: 'AN', region: 'Antarctica' },
  { code: 'HN', name: 'Honduras', continent: 'NA', region: 'Americas' },
  { code: 'HR', name: 'Croatia', continent: 'EU', region: 'Europe' },
  { code: 'HT', name: 'Haiti', continent: 'NA', region: 'Americas' },
  { code: 'HU', name: 'Hungary', continent: 'EU', region: 'Europe' },
  { code: 'ID', name: 'Indonesia', continent: 'AS', region: 'Asia' },
  { code: 'IE', name: 'Ireland', continent: 'EU', region: 'Europe' },
  { code: 'IL', name: 'Israel', continent: 'AS', region: 'Middle East' },
  { code: 'IM', name: 'Isle of Man', continent: 'EU', region: 'Europe' },
  { code: 'IN', name: 'India', continent: 'AS', region: 'Asia' },
  { code: 'IO', name: 'British Indian Ocean Territory', continent: 'AS', region: 'Asia' },
  { code: 'IQ', name: 'Iraq', continent: 'AS', region: 'Middle East' },
  { code: 'IR', name: 'Iran', continent: 'AS', region: 'Middle East' },
  { code: 'IS', name: 'Iceland', continent: 'EU', region: 'Europe' },
  { code: 'IT', name: 'Italy', continent: 'EU', region: 'Europe' },
  { code: 'JE', name: 'Jersey', continent: 'EU', region: 'Europe' },
  { code: 'JM', name: 'Jamaica', continent: 'NA', region: 'Americas' },
  { code: 'JO', name: 'Jordan', continent: 'AS', region: 'Middle East' },
  { code: 'JP', name: 'Japan', continent: 'AS', region: 'Asia' },
  { code: 'KE', name: 'Kenya', continent: 'AF', region: 'Africa' },
  { code: 'KG', name: 'Kyrgyzstan', continent: 'AS', region: 'Asia' },
  { code: 'KH', name: 'Cambodia', continent: 'AS', region: 'Asia' },
  { code: 'KI', name: 'Kiribati', continent: 'OC', region: 'Oceania' },
  { code: 'KM', name: 'Comoros', continent: 'AF', region: 'Africa' },
  { code: 'KN', name: 'Saint Kitts and Nevis', continent: 'NA', region: 'Americas' },
  { code: 'KP', name: 'North Korea', continent: 'AS', region: 'Asia' },
  { code: 'KR', name: 'South Korea', continent: 'AS', region: 'Asia' },
  { code: 'KW', name: 'Kuwait', continent: 'AS', region: 'Middle East' },
  { code: 'KY', name: 'Cayman Islands', continent: 'NA', region: 'Americas' },
  { code: 'KZ', name: 'Kazakhstan', continent: 'AS', region: 'Asia' },
  { code: 'LA', name: 'Laos', continent: 'AS', region: 'Asia' },
  { code: 'LB', name: 'Lebanon', continent: 'AS', region: 'Middle East' },
  { code: 'LC', name: 'Saint Lucia', continent: 'NA', region: 'Americas' },
  { code: 'LI', name: 'Liechtenstein', continent: 'EU', region: 'Europe' },
  { code: 'LK', name: 'Sri Lanka', continent: 'AS', region: 'Asia' },
  { code: 'LR', name: 'Liberia', continent: 'AF', region: 'Africa' },
  { code: 'LS', name: 'Lesotho', continent: 'AF', region: 'Africa' },
  { code: 'LT', name: 'Lithuania', continent: 'EU', region: 'Europe' },
  { code: 'LU', name: 'Luxembourg', continent: 'EU', region: 'Europe' },
  { code: 'LV', name: 'Latvia', continent: 'EU', region: 'Europe' },
  { code: 'LY', name: 'Libya', continent: 'AF', region: 'Africa' },
  { code: 'MA', name: 'Morocco', continent: 'AF', region: 'Africa' },
  { code: 'MC', name: 'Monaco', continent: 'EU', region: 'Europe' },
  { code: 'MD', name: 'Moldova', continent: 'EU', region: 'Europe' },
  { code: 'ME', name: 'Montenegro', continent: 'EU', region: 'Europe' },
  { code: 'MF', name: 'Saint Martin', continent: 'NA', region: 'Americas' },
  { code: 'MG', name: 'Madagascar', continent: 'AF', region: 'Africa' },
  { code: 'MH', name: 'Marshall Islands', continent: 'OC', region: 'Oceania' },
  { code: 'MK', name: 'North Macedonia', continent: 'EU', region: 'Europe' },
  { code: 'ML', name: 'Mali', continent: 'AF', region: 'Africa' },
  { code: 'MM', name: 'Myanmar', continent: 'AS', region: 'Asia' },
  { code: 'MN', name: 'Mongolia', continent: 'AS', region: 'Asia' },
  { code: 'MO', name: 'Macao', continent: 'AS', region: 'Asia' },
  { code: 'MP', name: 'Northern Mariana Islands', continent: 'OC', region: 'Oceania' },
  { code: 'MQ', name: 'Martinique', continent: 'NA', region: 'Americas' },
  { code: 'MR', name: 'Mauritania', continent: 'AF', region: 'Africa' },
  { code: 'MS', name: 'Montserrat', continent: 'NA', region: 'Americas' },
  { code: 'MT', name: 'Malta', continent: 'EU', region: 'Europe' },
  { code: 'MU', name: 'Mauritius', continent: 'AF', region: 'Africa' },
  { code: 'MV', name: 'Maldives', continent: 'AS', region: 'Asia' },
  { code: 'MW', name: 'Malawi', continent: 'AF', region: 'Africa' },
  { code: 'MX', name: 'Mexico', continent: 'NA', region: 'Americas' },
  { code: 'MY', name: 'Malaysia', continent: 'AS', region: 'Asia' },
  { code: 'MZ', name: 'Mozambique', continent: 'AF', region: 'Africa' },
  { code: 'NA', name: 'Namibia', continent: 'AF', region: 'Africa' },
  { code: 'NC', name: 'New Caledonia', continent: 'OC', region: 'Oceania' },
  { code: 'NE', name: 'Niger', continent: 'AF', region: 'Africa' },
  { code: 'NF', name: 'Norfolk Island', continent: 'OC', region: 'Oceania' },
  { code: 'NG', name: 'Nigeria', continent: 'AF', region: 'Africa' },
  { code: 'NI', name: 'Nicaragua', continent: 'NA', region: 'Americas' },
  { code: 'NL', name: 'Netherlands', continent: 'EU', region: 'Europe' },
  { code: 'NO', name: 'Norway', continent: 'EU', region: 'Europe' },
  { code: 'NP', name: 'Nepal', continent: 'AS', region: 'Asia' },
  { code: 'NR', name: 'Nauru', continent: 'OC', region: 'Oceania' },
  { code: 'NU', name: 'Niue', continent: 'OC', region: 'Oceania' },
  { code: 'NZ', name: 'New Zealand', continent: 'OC', region: 'Oceania' },
  { code: 'OM', name: 'Oman', continent: 'AS', region: 'Middle East' },
  { code: 'PA', name: 'Panama', continent: 'NA', region: 'Americas' },
  { code: 'PE', name: 'Peru', continent: 'SA', region: 'Americas' },
  { code: 'PF', name: 'French Polynesia', continent: 'OC', region: 'Oceania' },
  { code: 'PG', name: 'Papua New Guinea', continent: 'OC', region: 'Oceania' },
  { code: 'PH', name: 'Philippines', continent: 'AS', region: 'Asia' },
  { code: 'PK', name: 'Pakistan', continent: 'AS', region: 'Asia' },
  { code: 'PL', name: 'Poland', continent: 'EU', region: 'Europe' },
  { code: 'PM', name: 'Saint Pierre and Miquelon', continent: 'NA', region: 'Americas' },
  { code: 'PN', name: 'Pitcairn Islands', continent: 'OC', region: 'Oceania' },
  { code: 'PR', name: 'Puerto Rico', continent: 'NA', region: 'Americas' },
  { code: 'PS', name: 'Palestine', continent: 'AS', region: 'Middle East' },
  { code: 'PT', name: 'Portugal', continent: 'EU', region: 'Europe' },
  { code: 'PW', name: 'Palau', continent: 'OC', region: 'Oceania' },
  { code: 'PY', name: 'Paraguay', continent: 'SA', region: 'Americas' },
  { code: 'QA', name: 'Qatar', continent: 'AS', region: 'Middle East' },
  { code: 'RE', name: 'Réunion', continent: 'AF', region: 'Africa' },
  { code: 'RO', name: 'Romania', continent: 'EU', region: 'Europe' },
  { code: 'RS', name: 'Serbia', continent: 'EU', region: 'Europe' },
  { code: 'RU', name: 'Russia', continent: 'EU', region: 'Europe' },
  { code: 'RW', name: 'Rwanda', continent: 'AF', region: 'Africa' },
  { code: 'SA', name: 'Saudi Arabia', continent: 'AS', region: 'Middle East' },
  { code: 'SB', name: 'Solomon Islands', continent: 'OC', region: 'Oceania' },
  { code: 'SC', name: 'Seychelles', continent: 'AF', region: 'Africa' },
  { code: 'SD', name: 'Sudan', continent: 'AF', region: 'Africa' },
  { code: 'SE', name: 'Sweden', continent: 'EU', region: 'Europe' },
  { code: 'SG', name: 'Singapore', continent: 'AS', region: 'Asia' },
  { code: 'SH', name: 'Saint Helena', continent: 'AF', region: 'Africa' },
  { code: 'SI', name: 'Slovenia', continent: 'EU', region: 'Europe' },
  { code: 'SJ', name: 'Svalbard and Jan Mayen', continent: 'EU', region: 'Europe' },
  { code: 'SK', name: 'Slovakia', continent: 'EU', region: 'Europe' },
  { code: 'SL', name: 'Sierra Leone', continent: 'AF', region: 'Africa' },
  { code: 'SM', name: 'San Marino', continent: 'EU', region: 'Europe' },
  { code: 'SN', name: 'Senegal', continent: 'AF', region: 'Africa' },
  { code: 'SO', name: 'Somalia', continent: 'AF', region: 'Africa' },
  { code: 'SR', name: 'Suriname', continent: 'SA', region: 'Americas' },
  { code: 'SS', name: 'South Sudan', continent: 'AF', region: 'Africa' },
  { code: 'ST', name: 'São Tomé and Príncipe', continent: 'AF', region: 'Africa' },
  { code: 'SV', name: 'El Salvador', continent: 'NA', region: 'Americas' },
  { code: 'SX', name: 'Sint Maarten', continent: 'NA', region: 'Americas' },
  { code: 'SY', name: 'Syria', continent: 'AS', region: 'Middle East' },
  { code: 'SZ', name: 'Eswatini', continent: 'AF', region: 'Africa' },
  { code: 'TC', name: 'Turks and Caicos Islands', continent: 'NA', region: 'Americas' },
  { code: 'TD', name: 'Chad', continent: 'AF', region: 'Africa' },
  { code: 'TF', name: 'French Southern Territories', continent: 'AN', region: 'Antarctica' },
  { code: 'TG', name: 'Togo', continent: 'AF', region: 'Africa' },
  { code: 'TH', name: 'Thailand', continent: 'AS', region: 'Asia' },
  { code: 'TJ', name: 'Tajikistan', continent: 'AS', region: 'Asia' },
  { code: 'TK', name: 'Tokelau', continent: 'OC', region: 'Oceania' },
  { code: 'TL', name: 'Timor-Leste', continent: 'AS', region: 'Asia' },
  { code: 'TM', name: 'Turkmenistan', continent: 'AS', region: 'Asia' },
  { code: 'TN', name: 'Tunisia', continent: 'AF', region: 'Africa' },
  { code: 'TO', name: 'Tonga', continent: 'OC', region: 'Oceania' },
  { code: 'TR', name: 'Turkey', continent: 'AS', region: 'Middle East' },
  { code: 'TT', name: 'Trinidad and Tobago', continent: 'NA', region: 'Americas' },
  { code: 'TV', name: 'Tuvalu', continent: 'OC', region: 'Oceania' },
  { code: 'TW', name: 'Taiwan', continent: 'AS', region: 'Asia' },
  { code: 'TZ', name: 'Tanzania', continent: 'AF', region: 'Africa' },
  { code: 'UA', name: 'Ukraine', continent: 'EU', region: 'Europe' },
  { code: 'UG', name: 'Uganda', continent: 'AF', region: 'Africa' },
  { code: 'UM', name: 'U.S. Minor Outlying Islands', continent: 'OC', region: 'Oceania' },
  { code: 'US', name: 'United States', continent: 'NA', region: 'Americas' },
  { code: 'UY', name: 'Uruguay', continent: 'SA', region: 'Americas' },
  { code: 'UZ', name: 'Uzbekistan', continent: 'AS', region: 'Asia' },
  { code: 'VA', name: 'Vatican City', continent: 'EU', region: 'Europe' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', continent: 'NA', region: 'Americas' },
  { code: 'VE', name: 'Venezuela', continent: 'SA', region: 'Americas' },
  { code: 'VG', name: 'British Virgin Islands', continent: 'NA', region: 'Americas' },
  { code: 'VI', name: 'U.S. Virgin Islands', continent: 'NA', region: 'Americas' },
  { code: 'VN', name: 'Vietnam', continent: 'AS', region: 'Asia' },
  { code: 'VU', name: 'Vanuatu', continent: 'OC', region: 'Oceania' },
  { code: 'WF', name: 'Wallis and Futuna', continent: 'OC', region: 'Oceania' },
  { code: 'WS', name: 'Samoa', continent: 'OC', region: 'Oceania' },
  { code: 'XK', name: 'Kosovo', continent: 'EU', region: 'Europe' },
  { code: 'YE', name: 'Yemen', continent: 'AS', region: 'Middle East' },
  { code: 'YT', name: 'Mayotte', continent: 'AF', region: 'Africa' },
  { code: 'ZA', name: 'South Africa', continent: 'AF', region: 'Africa' },
  { code: 'ZM', name: 'Zambia', continent: 'AF', region: 'Africa' },
  { code: 'ZW', name: 'Zimbabwe', continent: 'AF', region: 'Africa' },
];

// ── US states (50 + DC) ─────────────────────────────────────────────

export const US_STATES: readonly UsState[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// ── EU (27 member states) ───────────────────────────────────────────

export const EU_COUNTRY_CODES: readonly string[] = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];

// ── Region definitions (named groups of country codes) ─────────────

export interface RegionDefinition {
  label: string;
  countryCodes: readonly string[];
}

/**
 * Named region groupings used for progress tracking in the Destinations view.
 * `us_states` uses state codes rather than country codes; consumers should
 * know whether a region is country-based or state-based.
 */
export const REGION_DEFINITIONS: Record<string, RegionDefinition> = {
  us_states: {
    label: 'US States',
    countryCodes: US_STATES.map((s) => s.code),
  },
  eu_countries: {
    label: 'European Union',
    countryCodes: EU_COUNTRY_CODES,
  },
  schengen: {
    label: 'Schengen Area',
    countryCodes: [
      'AT', 'BE', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
      'HU', 'IS', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO',
      'PL', 'PT', 'SK', 'SI', 'ES', 'SE', 'CH',
    ],
  },
  g7: {
    label: 'G7',
    countryCodes: ['CA', 'FR', 'DE', 'IT', 'JP', 'GB', 'US'],
  },
  g20: {
    label: 'G20',
    countryCodes: [
      'AR', 'AU', 'BR', 'CA', 'CN', 'FR', 'DE', 'IN', 'ID', 'IT',
      'JP', 'MX', 'RU', 'SA', 'ZA', 'KR', 'TR', 'GB', 'US',
    ],
  },
  nordic: {
    label: 'Nordic Countries',
    countryCodes: ['DK', 'FI', 'IS', 'NO', 'SE'],
  },
  asean: {
    label: 'ASEAN',
    countryCodes: ['BN', 'KH', 'ID', 'LA', 'MY', 'MM', 'PH', 'SG', 'TH', 'VN'],
  },
  caribbean: {
    label: 'Caribbean',
    countryCodes: [
      'AG', 'AI', 'AW', 'BB', 'BS', 'BL', 'BQ', 'CU', 'CW', 'DM',
      'DO', 'GD', 'GP', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ',
      'MS', 'PR', 'SX', 'TC', 'TT', 'VC', 'VG', 'VI',
    ],
  },
};

// ── Lookup helpers ──────────────────────────────────────────────────

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));

export function getCountryByCode(code: string): Country | undefined {
  if (!code) return undefined;
  return COUNTRY_BY_CODE.get(code.toUpperCase());
}

export function getContinentCountries(continent: ContinentCode): Country[] {
  return COUNTRIES.filter((c) => c.continent === continent);
}

/**
 * Returns the list of country (or state) codes for a named region, or an
 * empty array if the region is unknown.
 */
export function getRegionCountries(regionKey: string): readonly string[] {
  return REGION_DEFINITIONS[regionKey]?.countryCodes ?? [];
}
