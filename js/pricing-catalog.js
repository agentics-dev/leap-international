(function (root) {
  var catalog = Object.freeze({
    currency: 'USD',
    incorporation: Object.freeze({ local: 6500, non_hk: 8500 }),
    secretary: Object.freeze({ standard: 1300, premium: 3800, shareholderSurcharge: 200 }),
    secretaryUpgrade: 2500,
    annualReturnRemediation: 1300,
    registeredOffice: 2500,
    audit: Object.freeze({ up_to_500k: 5000, '500k_to_2m': 8000, '2m_to_5m': 12000 }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
  else root.LeapPricing = catalog;
})(typeof window !== 'undefined' ? window : this);
