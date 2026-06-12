const bankList = {
  "United States": [
    "JPMorgan Chase & Co.",
    "Bank of America",
    "Citigroup (Citi)",
    "Wells Fargo & Co.",
    "Goldman Sachs Group",
    "Morgan Stanley",
    "U.S. Bancorp",
    "PNC Financial Services",
    "Truist Financial",
    "Capital One Financial"
  ],
  "United Kingdom": [
    "HSBC Holdings",
    "Barclays PLC",
    "Lloyds Banking Group",
    "NatWest Group",
    "Standard Chartered",
    "Nationwide Building Society",
    "Santander UK",
    "Virgin Money UK"
  ],
  "Canada": [
    "Royal Bank of Canada (RBC)",
    "Toronto-Dominion Bank (TD)",
    "Scotiabank (Bank of Nova Scotia)",
    "Bank of Montreal (BMO)",
    "Canadian Imperial Bank of Commerce (CIBC)",
    "National Bank of Canada",
    "Desjardins Group"
  ],
  "Australia": [
    "Commonwealth Bank of Australia (CBA)",
    "Westpac Banking Corporation",
    "National Australia Bank (NAB)",
    "Australia and New Zealand Banking Group (ANZ)",
    "Macquarie Group",
    "Bendigo and Adelaide Bank",
    "Suncorp Bank"
  ],
  "Germany": [
    "Deutsche Bank AG",
    "Commerzbank AG",
    "DZ Bank",
    "Landesbank Baden-Württemberg (LBBW)",
    "BayernLB",
    "Sparkasse (Savings Bank Group)",
    "N26 Bank"
  ],
  "France": [
    "BNP Paribas",
    "Crédit Agricole Group",
    "Société Générale",
    "Groupe BPCE (Banque Populaire & Caisse d'Epargne)",
    "La Banque Postale",
    "Crédit Mutuel Alliance Fédérale"
  ]
};

// Fallback banks for any other selected countries
const defaultBanks = [
  "Global Premier Settlement Bank",
  "Federal Reserve Union System",
  "International Commerce Bank",
  "Standard Merchant Bank",
  "Apex Clearing Corp"
];

function getBanksForCountry(country) {
  return bankList[country] || defaultBanks;
}

// ─── United States: Full 9-digit ABA Routing Number Lookup ───────────────────
const US_ROUTING_EXACT = {
  // JPMorgan Chase
  "021000021": "JPMorgan Chase & Co.",
  "021202337": "JPMorgan Chase & Co.",
  "022300173": "JPMorgan Chase & Co.",
  "044000037": "JPMorgan Chase & Co.",
  "072000326": "JPMorgan Chase & Co.",
  "075000019": "JPMorgan Chase & Co.",
  "083000137": "JPMorgan Chase & Co.",
  "102001017": "JPMorgan Chase & Co.",
  "103000648": "JPMorgan Chase & Co.",
  "111000614": "JPMorgan Chase & Co.",
  "113000609": "JPMorgan Chase & Co.",
  "120000726": "JPMorgan Chase & Co.",
  "122100024": "JPMorgan Chase & Co.",
  "123271978": "JPMorgan Chase & Co.",
  "124001545": "JPMorgan Chase & Co.",
  "267084131": "JPMorgan Chase & Co.",
  "322271627": "JPMorgan Chase & Co.",
  "325070760": "JPMorgan Chase & Co.",

  // Bank of America
  "021000322": "Bank of America",
  "026009593": "Bank of America",
  "051000017": "Bank of America",
  "081904808": "Bank of America",
  "101000035": "Bank of America",
  "103100195": "Bank of America",
  "111000012": "Bank of America",
  "113010547": "Bank of America",
  "121000358": "Bank of America",
  "122400724": "Bank of America",
  "053904483": "Bank of America",
  "052001633": "Bank of America",
  "063100277": "Bank of America",
  "081000032": "Bank of America",

  // Citibank / Citigroup
  "021000089": "Citigroup (Citi)",
  "021272655": "Citigroup (Citi)",
  "254070116": "Citigroup (Citi)",
  "271070801": "Citigroup (Citi)",
  "322271724": "Citigroup (Citi)",

  // Wells Fargo
  "121042882": "Wells Fargo & Co.",
  "091000019": "Wells Fargo & Co.",
  "102000076": "Wells Fargo & Co.",
  "107002192": "Wells Fargo & Co.",
  "111900659": "Wells Fargo & Co.",
  "121000248": "Wells Fargo & Co.",
  "123006800": "Wells Fargo & Co.",
  "125008547": "Wells Fargo & Co.",
  "031000503": "Wells Fargo & Co.",
  "053000219": "Wells Fargo & Co.",

  // Goldman Sachs
  "026015079": "Goldman Sachs Group",
  "124085244": "Goldman Sachs Group",

  // Morgan Stanley
  "021000238": "Morgan Stanley",
  "101119611": "Morgan Stanley",

  // U.S. Bancorp (US Bank)
  "042000013": "U.S. Bancorp",
  "061000227": "U.S. Bancorp",
  "073000545": "U.S. Bancorp",
  "091000022": "U.S. Bancorp",
  "103100179": "U.S. Bancorp",
  "123103729": "U.S. Bancorp",
  "124302150": "U.S. Bancorp",

  // PNC Bank
  "031000053": "PNC Financial Services",
  "036001808": "PNC Financial Services",
  "041000124": "PNC Financial Services",
  "043000096": "PNC Financial Services",
  "054000030": "PNC Financial Services",
  "055003308": "PNC Financial Services",
  "071921891": "PNC Financial Services",
  "083000108": "PNC Financial Services",

  // Truist (formerly BB&T / SunTrust)
  "053101121": "Truist Financial",
  "061000227": "Truist Financial",
  "061104102": "Truist Financial",
  "055002707": "Truist Financial",
  "266086554": "Truist Financial",
  "091409571": "Truist Financial",
  "053000196": "Truist Financial",

  // Capital One
  "051405515": "Capital One Financial",
  "056073502": "Capital One Financial",
  "065000090": "Capital One Financial",
  "073972181": "Capital One Financial",
  "107006958": "Capital One Financial",
};

// ─── UK Sort Code Exact Lookup (6 digits) ───────────────────────────────────
const UK_SORT_EXACT = {
  // Barclays
  "200000": "Barclays PLC", "200415": "Barclays PLC", "200918": "Barclays PLC",
  "201516": "Barclays PLC", "203399": "Barclays PLC", "204834": "Barclays PLC",
  "207206": "Barclays PLC", "208222": "Barclays PLC", "209430": "Barclays PLC",

  // HSBC
  "400003": "HSBC Holdings", "400430": "HSBC Holdings", "401016": "HSBC Holdings",
  "402304": "HSBC Holdings", "403611": "HSBC Holdings", "404310": "HSBC Holdings",
  "404442": "HSBC Holdings", "405010": "HSBC Holdings", "406406": "HSBC Holdings",

  // Lloyds
  "300000": "Lloyds Banking Group", "301530": "Lloyds Banking Group",
  "309210": "Lloyds Banking Group", "309516": "Lloyds Banking Group",
  "309696": "Lloyds Banking Group", "309814": "Lloyds Banking Group",
  "777777": "Lloyds Banking Group",

  // NatWest
  "500000": "NatWest Group", "501821": "NatWest Group", "550108": "NatWest Group",
  "560001": "NatWest Group", "600006": "NatWest Group", "601613": "NatWest Group",
  "607107": "NatWest Group", "608371": "NatWest Group", "609242": "NatWest Group",

  // Nationwide
  "070030": "Nationwide Building Society", "070093": "Nationwide Building Society",
  "070116": "Nationwide Building Society",

  // Santander UK
  "090128": "Santander UK", "090129": "Santander UK", "090134": "Santander UK",

  // Standard Chartered
  "790001": "Standard Chartered", "790002": "Standard Chartered",

  // Virgin Money
  "820001": "Virgin Money UK", "821001": "Virgin Money UK",
};

// ─── Australia BSB Exact Lookup (6 digits) ──────────────────────────────────
const AU_BSB_EXACT = {
  // ANZ
  "010000": "Australia and New Zealand Banking Group (ANZ)",
  "010001": "Australia and New Zealand Banking Group (ANZ)",
  "012002": "Australia and New Zealand Banking Group (ANZ)",
  "013002": "Australia and New Zealand Banking Group (ANZ)",
  "015003": "Australia and New Zealand Banking Group (ANZ)",

  // Westpac
  "032000": "Westpac Banking Corporation", "032001": "Westpac Banking Corporation",
  "033002": "Westpac Banking Corporation", "034003": "Westpac Banking Corporation",
  "035000": "Westpac Banking Corporation",

  // Commonwealth Bank
  "062000": "Commonwealth Bank of Australia (CBA)",
  "062001": "Commonwealth Bank of Australia (CBA)",
  "063000": "Commonwealth Bank of Australia (CBA)",
  "063001": "Commonwealth Bank of Australia (CBA)",
  "064000": "Commonwealth Bank of Australia (CBA)",

  // NAB
  "082000": "National Australia Bank (NAB)", "083000": "National Australia Bank (NAB)",
  "084000": "National Australia Bank (NAB)", "086000": "National Australia Bank (NAB)",

  // Macquarie
  "182512": "Macquarie Group", "182222": "Macquarie Group",

  // Bendigo
  "633000": "Bendigo and Adelaide Bank", "633108": "Bendigo and Adelaide Bank",

  // Suncorp
  "484799": "Suncorp Bank", "484000": "Suncorp Bank",
};

// ─── Canada Institution Code Lookup ─────────────────────────────────────────
const CA_INSTITUTION_CODES = {
  "001": "Bank of Montreal (BMO)",
  "002": "Scotiabank (Bank of Nova Scotia)",
  "003": "Royal Bank of Canada (RBC)",
  "004": "Toronto-Dominion Bank (TD)",
  "006": "National Bank of Canada",
  "010": "Canadian Imperial Bank of Commerce (CIBC)",
  "177": "Desjardins Group",
  "815": "Desjardins Group",
  "809": "Desjardins Group",
};

// ─── German BLZ (Bankleitzahl) Exact & Prefix Lookup ────────────────────────
const DE_BLZ_EXACT = {
  "10020000": "Commerzbank AG",
  "10070000": "Deutsche Bank AG",
  "10070024": "Deutsche Bank AG",
  "20070000": "Deutsche Bank AG",
  "37040044": "Commerzbank AG",
  "20080000": "Commerzbank AG",
  "30060601": "DZ Bank",
  "10011001": "N26 Bank",
  "60050101": "Landesbank Baden-Württemberg (LBBW)",
  "70020270": "BayernLB",
  "10050000": "Sparkasse (Savings Bank Group)",
  "20050550": "Sparkasse (Savings Bank Group)",
  "30050000": "Sparkasse (Savings Bank Group)",
};

const DE_BLZ_PREFIX = [
  { prefix: "100700", bank: "Deutsche Bank AG" },
  { prefix: "200700", bank: "Deutsche Bank AG" },
  { prefix: "300700", bank: "Deutsche Bank AG" },
  { prefix: "370400", bank: "Commerzbank AG" },
  { prefix: "200400", bank: "Commerzbank AG" },
  { prefix: "300600", bank: "DZ Bank" },
  { prefix: "100110", bank: "N26 Bank" },
  { prefix: "600500", bank: "Landesbank Baden-Württemberg (LBBW)" },
  { prefix: "600501", bank: "Landesbank Baden-Württemberg (LBBW)" },
  { prefix: "700200", bank: "BayernLB" },
];

// ─── French Bank Code (5-digit code banque from IBAN) ───────────────────────
const FR_BANK_CODES = {
  "30004": "BNP Paribas",
  "30003": "Société Générale",
  "30002": "Crédit Lyonnais (LCL)",
  "39996": "Crédit Agricole Group",
  "18206": "Crédit Agricole Group",
  "15589": "Crédit Agricole Group",
  "10278": "Crédit Mutuel Alliance Fédérale",
  "30007": "Crédit Mutuel Alliance Fédérale",
  "20041": "La Banque Postale",
  "14518": "Groupe BPCE (Banque Populaire & Caisse d'Epargne)",
  "17515": "Groupe BPCE (Banque Populaire & Caisse d'Epargne)",
  "13106": "Groupe BPCE (Banque Populaire & Caisse d'Epargne)",
  "18215": "Groupe BPCE (Banque Populaire & Caisse d'Epargne)",
};

// ─── Main Detection Function ─────────────────────────────────────────────────
function detectBankFromCode(code, country) {
  if (!code) return "";
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return "";
  const digits = clean.replace(/[^0-9]/g, "");

  // ── United States ──────────────────────────────────────────────────────────
  if (country === 'United States') {
    // Try exact 9-digit match first
    const r9 = digits.substring(0, 9);
    if (r9.length === 9 && US_ROUTING_EXACT[r9]) return US_ROUTING_EXACT[r9];
    return "";
  }

  // ── United Kingdom ─────────────────────────────────────────────────────────
  if (country === 'United Kingdom') {
    const sc = digits.substring(0, 6);
    if (sc.length === 6) {
      // Exact sort code lookup
      if (UK_SORT_EXACT[sc]) return UK_SORT_EXACT[sc];
      // Prefix fallback (first 2 digits = bank identifier range)
      const p2 = parseInt(sc.substring(0, 2));
      if (p2 >= 20 && p2 <= 29) return "Barclays PLC";
      if (p2 >= 30 && p2 <= 39) return "Lloyds Banking Group";
      if (p2 >= 40 && p2 <= 49) return "HSBC Holdings";
      if (p2 >= 50 && p2 <= 69) return "NatWest Group";
      if (p2 === 9) return "Santander UK";
      if (p2 === 79) return "Standard Chartered";
      if (p2 === 7 || p2 === 5) return "Nationwide Building Society";
      if (p2 === 8 || p2 === 82) return "Virgin Money UK";
    }
    return "";
  }

  // ── Australia ──────────────────────────────────────────────────────────────
  if (country === 'Australia') {
    const bsb = digits.substring(0, 6);
    if (bsb.length === 6) {
      if (AU_BSB_EXACT[bsb]) return AU_BSB_EXACT[bsb];
      const p2 = bsb.substring(0, 2);
      if (p2 === '01' || p2 === '01') return "Australia and New Zealand Banking Group (ANZ)";
      if (p2 === '03' || p2 === '73') return "Westpac Banking Corporation";
      if (p2 === '06') return "Commonwealth Bank of Australia (CBA)";
      if (p2 === '08') return "National Australia Bank (NAB)";
      if (p2 === '18') return "Macquarie Group";
      if (p2 === '63') return "Bendigo and Adelaide Bank";
      if (p2 === '48') return "Suncorp Bank";
    }
    return "";
  }

  // ── Canada ─────────────────────────────────────────────────────────────────
  if (country === 'Canada') {
    // Canadian transit number format: XXXXX-YYY (5-digit branch + 3-digit institution)
    // Or 8-digit: XXXXXYYY
    const parts = code.split('-');
    let instCode = "";
    if (parts.length >= 2) {
      instCode = parts[1].replace(/[^0-9]/g, "").substring(0, 3);
    } else {
      if (digits.length === 8) instCode = digits.substring(5, 8);
      else if (digits.length === 9) instCode = digits.substring(6, 9);
    }
    if (instCode && CA_INSTITUTION_CODES[instCode]) return CA_INSTITUTION_CODES[instCode];
    return "";
  }

  // ── Germany (IBAN: DE + 2 check digits + 8-digit BLZ + 10-digit account) ──
  if (country === 'Germany') {
    if (clean.startsWith('DE') && clean.length >= 14) {
      const blz = clean.substring(4, 12);
      if (DE_BLZ_EXACT[blz]) return DE_BLZ_EXACT[blz];
      for (const { prefix, bank } of DE_BLZ_PREFIX) {
        if (blz.startsWith(prefix)) return bank;
      }
      // Further prefix fallback
      if (blz.startsWith('100700') || blz.startsWith('200700')) return "Deutsche Bank AG";
      if (blz.startsWith('370')) return "Commerzbank AG";
      if (blz.startsWith('300600')) return "DZ Bank";
      if (blz.startsWith('60050')) return "Landesbank Baden-Württemberg (LBBW)";
      if (blz.startsWith('70020')) return "BayernLB";
      if (blz.startsWith('1005') || blz.startsWith('2005') || blz.startsWith('3005')) return "Sparkasse (Savings Bank Group)";
    }
    return "";
  }

  // ── France (IBAN: FR + 2 check digits + 5-digit bank code + 5-digit branch + ...) ──
  if (country === 'France') {
    if (clean.startsWith('FR') && clean.length >= 9) {
      const bankCode = clean.substring(4, 9);
      if (FR_BANK_CODES[bankCode]) return FR_BANK_CODES[bankCode];
    }
    return "";
  }

  return "";
}

module.exports = {
  bankList,
  getBanksForCountry,
  detectBankFromCode
};
