const vm = require('vm');

// Test 1: bare context (no globals)
const ctx1 = vm.createContext({});
try {
  const r = vm.runInContext('typeof URL', ctx1);
  console.log('bare context: typeof URL =', r);
} catch(e) {
  console.log('bare context ERROR:', e.message);
}

// Test 2: context with some globals (closer to n8n)
const ctx2 = vm.createContext({ console, require });
try {
  const r = vm.runInContext('typeof URL', ctx2);
  console.log('with console+require: typeof URL =', r);
} catch(e) {
  console.log('with console+require ERROR:', e.message);
}

// Test 3: what fixUrl does with http URL when URL is not available
const code = `
function fixUrl(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  const withScheme = /^https?:\\/\\//i.test(s) ? s : 'https://' + s;
  try {
    const p = new URL(withScheme);
    return p.href;
  } catch(e) { return 'ERROR:' + e.message; }
}
fixUrl('http://ooo-pkf-avangard.ru');
`;

// In bare context
try {
  const r = vm.runInContext(code, vm.createContext({}));
  console.log('fixUrl in bare context:', r);
} catch(e) {
  console.log('fixUrl SYNTAX ERROR in bare context:', e.message);
}

// In context with globalThis
try {
  const r = vm.runInContext(code, vm.createContext({ URL }));
  console.log('fixUrl with URL in context:', r);
} catch(e) {
  console.log('fixUrl with URL ERROR:', e.message);
}
