const adapt = require('../_content-adapter');
const handler = require('../../api/comparisons');

export const onRequest = adapt(handler);
