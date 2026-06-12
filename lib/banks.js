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

function detectBankFromCode(code, country) {
  if (!code) return "";
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return "";

  if (country === 'United Kingdom') {
    const digits = clean.replace(/[^0-9]/g, "");
    if (digits.length >= 2) {
      const prefix2 = digits.substring(0, 2);
      if (prefix2 === '20' || (parseInt(prefix2) >= 20 && parseInt(prefix2) <= 29)) return "Barclays PLC";
      if (prefix2 === '30' || (parseInt(prefix2) >= 30 && parseInt(prefix2) <= 39)) return "Lloyds Banking Group";
      if (prefix2 === '40' || (parseInt(prefix2) >= 40 && parseInt(prefix2) <= 49)) return "HSBC Holdings";
      if (prefix2 === '50' || prefix2 === '60' || (parseInt(prefix2) >= 50 && parseInt(prefix2) <= 69)) return "NatWest Group";
      if (prefix2 === '09') return "Santander UK";
      if (prefix2 === '79') return "Standard Chartered";
      if (prefix2 === '05' || prefix2 === '07') return "Nationwide Building Society";
      if (prefix2 === '08' || prefix2 === '82') return "Virgin Money UK";
    }
  }

  if (country === 'United States') {
    const digits = clean.replace(/[^0-9]/g, "");
    if (digits.length >= 4) {
      const prefix4 = digits.substring(0, 4);
      const prefix9 = digits.substring(0, 9);
      if (['0210', '0211', '0212', '0213', '0710', '1110'].includes(prefix4)) return "JPMorgan Chase & Co.";
      if (['0260', '0530', '1130', '1210'].includes(prefix4)) return "Bank of America";
      if (['2110', '3211'].includes(prefix4) || prefix9.startsWith('02100008') || prefix9.startsWith('02100001')) return "Citigroup (Citi)";
      if (['1211', '1220', '0910', '0739'].includes(prefix4) || prefix9.startsWith('12100024')) return "Wells Fargo & Co.";
      if (prefix9.startsWith('02100002') || prefix9.startsWith('02600583')) return "Goldman Sachs Group";
      if (prefix9.startsWith('02100003')) return "Morgan Stanley";
      if (prefix9.startsWith('09100002') || prefix9.startsWith('12100022')) return "U.S. Bancorp";
      if (prefix9.startsWith('03100005') || ['0430', '0720'].includes(prefix4)) return "PNC Financial Services";
      if (['0531', '0610', '0510'].includes(prefix4)) return "Truist Financial";
      if (['0514', '0515', '0540', '0311'].includes(prefix4)) return "Capital One Financial";
    }
  }

  if (country === 'Australia') {
    const digits = clean.replace(/[^0-9]/g, "");
    if (digits.length >= 2) {
      const prefix2 = digits.substring(0, 2);
      if (prefix2 === '01') return "Australia and New Zealand Banking Group (ANZ)";
      if (prefix2 === '03' || prefix2 === '73') return "Westpac Banking Corporation";
      if (prefix2 === '06') return "Commonwealth Bank of Australia (CBA)";
      if (prefix2 === '08') return "National Australia Bank (NAB)";
      if (prefix2 === '18') return "Macquarie Group";
      if (prefix2 === '63') return "Bendigo and Adelaide Bank";
      if (prefix2 === '48') return "Suncorp Bank";
    }
  }

  if (country === 'Canada') {
    const parts = code.split('-');
    let instCode = "";
    if (parts.length > 1) {
      instCode = parts[1].replace(/[^0-9]/g, "").substring(0, 3);
    } else {
      const digits = clean.replace(/[^0-9]/g, "");
      if (digits.length === 8) {
        instCode = digits.substring(5, 8);
      } else if (digits.length === 9) {
        instCode = digits.substring(0, 3);
      }
    }
    if (instCode) {
      if (instCode === '001') return "Bank of Montreal (BMO)";
      if (instCode === '002') return "Scotiabank (Bank of Nova Scotia)";
      if (instCode === '003') return "Royal Bank of Canada (RBC)";
      if (instCode === '004') return "Toronto-Dominion Bank (TD)";
      if (instCode === '006') return "National Bank of Canada";
      if (instCode === '010') return "Canadian Imperial Bank of Commerce (CIBC)";
    }
    const digits = clean.replace(/[^0-9]/g, "");
    if (digits.includes('003')) return "Royal Bank of Canada (RBC)";
    if (digits.includes('004')) return "Toronto-Dominion Bank (TD)";
    if (digits.includes('002')) return "Scotiabank (Bank of Nova Scotia)";
    if (digits.includes('001')) return "Bank of Montreal (BMO)";
    if (digits.includes('010')) return "Canadian Imperial Bank of Commerce (CIBC)";
    if (digits.includes('006')) return "National Bank of Canada";
  }

  if (country === 'Germany' || country === 'France') {
    if (clean.startsWith('DE')) {
      const bankCode = clean.substring(4, 12);
      if (bankCode.startsWith('1007') || bankCode.startsWith('1002')) return "Deutsche Bank AG";
      if (bankCode.startsWith('2004') || bankCode.startsWith('3704') || bankCode.startsWith('2008') || bankCode.startsWith('370')) return "Commerzbank AG";
      if (bankCode.startsWith('3006')) return "DZ Bank";
      if (bankCode.startsWith('10011')) return "N26 Bank";
      if (bankCode.startsWith('6005') || bankCode.startsWith('600')) return "Landesbank Baden-Württemberg (LBBW)";
      if (bankCode.startsWith('7005') || bankCode.startsWith('700')) return "BayernLB";
      if (bankCode.startsWith('390') || bankCode.startsWith('3705') || bankCode.startsWith('4') || bankCode.startsWith('5')) return "Sparkasse (Savings Bank Group)";
    } else if (clean.startsWith('FR')) {
      const bankCode = clean.substring(4, 9);
      if (bankCode === '30004') return "BNP Paribas";
      if (bankCode === '30003') return "Société Générale";
      if (bankCode.startsWith('1')) return "Crédit Agricole Group";
      if (bankCode === '20041') return "La Banque Postale";
    }
  }

  return "";
}

module.exports = {
  bankList,
  getBanksForCountry,
  detectBankFromCode
};
