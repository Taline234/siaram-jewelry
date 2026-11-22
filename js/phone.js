// Country code picker for every phone box on the site (<input type="tel">), including the ones the store draws later
// (checkout, account, Record a Sale). A flag and code sit in front of the box; the box itself always holds the whole
// number with its code ("+961 70 123 456"), so the forms and the database need no change. A number typed with a
// leading 0 ("03 123 456") gets the chosen code instead of the 0, and typing "+44..." switches the flag by itself.
(() => {
  // [ISO code, name, dialling code]. Lebanon first, then the countries customers most often write from, then the rest.
  const COUNTRIES = [
    ['LB', 'Lebanon', '961'], ['AE', 'United Arab Emirates', '971'], ['SA', 'Saudi Arabia', '966'], ['QA', 'Qatar', '974'],
    ['KW', 'Kuwait', '965'], ['FR', 'France', '33'], ['GB', 'United Kingdom', '44'], ['US', 'United States', '1'],
    ['CA', 'Canada', '1'], ['AU', 'Australia', '61'], ['DE', 'Germany', '49'], ['CY', 'Cyprus', '357'],
    ['AF', 'Afghanistan', '93'], ['AL', 'Albania', '355'], ['DZ', 'Algeria', '213'], ['AD', 'Andorra', '376'],
    ['AO', 'Angola', '244'], ['AR', 'Argentina', '54'], ['AM', 'Armenia', '374'], ['AT', 'Austria', '43'],
    ['AZ', 'Azerbaijan', '994'], ['BS', 'Bahamas', '1'], ['BH', 'Bahrain', '973'], ['BD', 'Bangladesh', '880'],
    ['BY', 'Belarus', '375'], ['BE', 'Belgium', '32'], ['BZ', 'Belize', '501'], ['BJ', 'Benin', '229'],
    ['BT', 'Bhutan', '975'], ['BO', 'Bolivia', '591'], ['BA', 'Bosnia and Herzegovina', '387'], ['BW', 'Botswana', '267'],
    ['BR', 'Brazil', '55'], ['BN', 'Brunei', '673'], ['BG', 'Bulgaria', '359'], ['BF', 'Burkina Faso', '226'],
    ['BI', 'Burundi', '257'], ['KH', 'Cambodia', '855'], ['CM', 'Cameroon', '237'], ['CV', 'Cape Verde', '238'],
    ['CF', 'Central African Republic', '236'], ['TD', 'Chad', '235'], ['CL', 'Chile', '56'], ['CN', 'China', '86'],
    ['CO', 'Colombia', '57'], ['KM', 'Comoros', '269'], ['CG', 'Congo', '242'], ['CD', 'Congo (DRC)', '243'],
    ['CR', 'Costa Rica', '506'], ['CI', "Côte d'Ivoire", '225'], ['HR', 'Croatia', '385'], ['CU', 'Cuba', '53'],
    ['CZ', 'Czechia', '420'], ['DK', 'Denmark', '45'], ['DJ', 'Djibouti', '253'], ['DO', 'Dominican Republic', '1'],
    ['EC', 'Ecuador', '593'], ['EG', 'Egypt', '20'], ['SV', 'El Salvador', '503'], ['GQ', 'Equatorial Guinea', '240'],
    ['ER', 'Eritrea', '291'], ['EE', 'Estonia', '372'], ['SZ', 'Eswatini', '268'], ['ET', 'Ethiopia', '251'],
    ['FJ', 'Fiji', '679'], ['FI', 'Finland', '358'], ['GA', 'Gabon', '241'], ['GM', 'Gambia', '220'],
    ['GE', 'Georgia', '995'], ['GH', 'Ghana', '233'], ['GR', 'Greece', '30'], ['GT', 'Guatemala', '502'],
    ['GN', 'Guinea', '224'], ['GY', 'Guyana', '592'], ['HT', 'Haiti', '509'], ['HN', 'Honduras', '504'],
    ['HK', 'Hong Kong', '852'], ['HU', 'Hungary', '36'], ['IS', 'Iceland', '354'], ['IN', 'India', '91'],
    ['ID', 'Indonesia', '62'], ['IR', 'Iran', '98'], ['IQ', 'Iraq', '964'], ['IE', 'Ireland', '353'],
    ['IT', 'Italy', '39'], ['JM', 'Jamaica', '1'], ['JP', 'Japan', '81'], ['JO', 'Jordan', '962'],
    ['KZ', 'Kazakhstan', '7'], ['KE', 'Kenya', '254'], ['XK', 'Kosovo', '383'], ['KG', 'Kyrgyzstan', '996'],
    ['LA', 'Laos', '856'], ['LV', 'Latvia', '371'], ['LS', 'Lesotho', '266'], ['LR', 'Liberia', '231'],
    ['LY', 'Libya', '218'], ['LI', 'Liechtenstein', '423'], ['LT', 'Lithuania', '370'], ['LU', 'Luxembourg', '352'],
    ['MO', 'Macao', '853'], ['MG', 'Madagascar', '261'], ['MW', 'Malawi', '265'], ['MY', 'Malaysia', '60'],
    ['MV', 'Maldives', '960'], ['ML', 'Mali', '223'], ['MT', 'Malta', '356'], ['MR', 'Mauritania', '222'],
    ['MU', 'Mauritius', '230'], ['MX', 'Mexico', '52'], ['MD', 'Moldova', '373'], ['MC', 'Monaco', '377'],
    ['MN', 'Mongolia', '976'], ['ME', 'Montenegro', '382'], ['MA', 'Morocco', '212'], ['MZ', 'Mozambique', '258'],
    ['MM', 'Myanmar', '95'], ['NA', 'Namibia', '264'], ['NP', 'Nepal', '977'], ['NL', 'Netherlands', '31'],
    ['NZ', 'New Zealand', '64'], ['NI', 'Nicaragua', '505'], ['NE', 'Niger', '227'], ['NG', 'Nigeria', '234'],
    ['KP', 'North Korea', '850'], ['MK', 'North Macedonia', '389'], ['NO', 'Norway', '47'], ['OM', 'Oman', '968'],
    ['PK', 'Pakistan', '92'], ['PS', 'Palestine', '970'], ['PA', 'Panama', '507'], ['PG', 'Papua New Guinea', '675'],
    ['PY', 'Paraguay', '595'], ['PE', 'Peru', '51'], ['PH', 'Philippines', '63'], ['PL', 'Poland', '48'],
    ['PT', 'Portugal', '351'], ['PR', 'Puerto Rico', '1'], ['RO', 'Romania', '40'], ['RU', 'Russia', '7'],
    ['RW', 'Rwanda', '250'], ['SM', 'San Marino', '378'], ['SN', 'Senegal', '221'], ['RS', 'Serbia', '381'],
    ['SC', 'Seychelles', '248'], ['SL', 'Sierra Leone', '232'], ['SG', 'Singapore', '65'], ['SK', 'Slovakia', '421'],
    ['SI', 'Slovenia', '386'], ['SO', 'Somalia', '252'], ['ZA', 'South Africa', '27'], ['KR', 'South Korea', '82'],
    ['SS', 'South Sudan', '211'], ['ES', 'Spain', '34'], ['LK', 'Sri Lanka', '94'], ['SD', 'Sudan', '249'],
    ['SR', 'Suriname', '597'], ['SE', 'Sweden', '46'], ['CH', 'Switzerland', '41'], ['SY', 'Syria', '963'],
    ['TW', 'Taiwan', '886'], ['TJ', 'Tajikistan', '992'], ['TZ', 'Tanzania', '255'], ['TH', 'Thailand', '66'],
    ['TG', 'Togo', '228'], ['TT', 'Trinidad and Tobago', '1'], ['TN', 'Tunisia', '216'], ['TR', 'Türkiye', '90'],
    ['TM', 'Turkmenistan', '993'], ['UG', 'Uganda', '256'], ['UA', 'Ukraine', '380'], ['UY', 'Uruguay', '598'],
    ['UZ', 'Uzbekistan', '998'], ['VA', 'Vatican City', '39'], ['VE', 'Venezuela', '58'], ['VN', 'Vietnam', '84'],
    ['YE', 'Yemen', '967'], ['ZM', 'Zambia', '260'], ['ZW', 'Zimbabwe', '263'],
  ];
  const TOP = 12; // the first 12 are listed above a divider
  const flag = (iso) => String.fromCodePoint(...[...iso].map((c) => 0x1f1a5 + c.charCodeAt(0)));
  // Longest codes first, so "+961" is not read as "+96" or "+9".
  const BY_CODE = [...COUNTRIES].sort((a, b) => b[2].length - a[2].length);

  // The country a full number belongs to; keeps the current one when several share the code (+1, +7, +39, +44).
  function countryOf(value, current) {
    const digits = value.replace(/[^\d+]/g, '');
    if (!digits.startsWith('+')) return null;
    if (current && digits.startsWith(`+${current[2]}`)) return current;
    return BY_CODE.find((c) => digits.startsWith(`+${c[2]}`)) || null;
  }

  // "03 123 456" with Lebanon chosen -> "+961 3 123 456"; "0044 7..." -> "+44 7..."; numbers with + are kept.
  function complete(value, country) {
    const v = value.trim();
    if (!v || v.replace(/\D/g, '') === country[2]) return '';
    if (v.startsWith('+')) return v;
    if (v.startsWith('00')) return `+${v.slice(2).trim()}`;
    return `+${country[2]} ${v.replace(/^0+/, '')}`;
  }

  function enhance(input) {
    if (input.dataset.phoneReady) return;
    input.dataset.phoneReady = '1';
    let country = countryOf(input.value, null) || COUNTRIES[0];

    const wrap = document.createElement('span');
    wrap.className = 'phone-field';
    const picker = document.createElement('span');
    picker.className = 'phone-cc';
    const shown = document.createElement('span');
    shown.className = 'phone-cc-shown';
    shown.setAttribute('aria-hidden', 'true');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Country code');
    select.innerHTML = COUNTRIES.map(([iso, name, code], i) =>
      `${i === TOP ? '<option disabled>──────────</option>' : ''}<option value="${iso}">${flag(iso)} ${name} (+${code})</option>`).join('');
    picker.append(shown, select);
    input.replaceWith(wrap);
    // The box comes first in the page, so tapping the field's label still goes to the box, not the picker.
    wrap.append(input, picker);

    const show = () => {
      select.value = country[0];
      shown.textContent = `${flag(country[0])} +${country[2]}`;
    };
    show();

    select.addEventListener('change', () => {
      const old = country;
      country = COUNTRIES.find((c) => c[0] === select.value) || country;
      show();
      // Swap the code already in the box for the new one.
      const v = input.value.trim();
      if (v.startsWith(`+${old[2]}`)) input.value = `+${country[2]} ${v.slice(old[2].length + 1).trim()}`.trim();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    input.addEventListener('focus', () => {
      if (!input.value.trim()) input.value = `+${country[2]} `;
    });
    input.addEventListener('input', () => {
      // A full number typed or pasted after the code we put in the box ("+961 +961 70...", "+961 0096170..."):
      // keep the number as typed.
      const again = input.value.match(/^\+\d+\s*((?:\+|00)\d.*)$/);
      if (again) input.value = again[1].replace(/^00/, '+');
      const found = countryOf(input.value, country);
      if (found && found !== country) { country = found; show(); }
    });
    const tidy = () => {
      const done = complete(input.value, country);
      if (done !== input.value) {
        input.value = done;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    input.addEventListener('blur', tidy);
    input._phoneTidy = tidy;
  }

  // Before any form's own submit code reads the boxes (capture runs first), make sure each number is complete.
  document.addEventListener('submit', (e) => {
    e.target.querySelectorAll?.('input[type=tel]').forEach((i) => i._phoneTidy && i._phoneTidy());
  }, true);

  const scan = (root) => root.querySelectorAll?.('input[type=tel]').forEach(enhance);
  const start = () => {
    scan(document);
    new MutationObserver((changes) => changes.forEach((c) => c.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches('input[type=tel]')) enhance(n);
      else scan(n);
    }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
