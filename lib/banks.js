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

module.exports = {
  bankList,
  getBanksForCountry
};
