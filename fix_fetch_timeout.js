const fs = require('fs');

['Astra_Email_Extractor_v1_FINAL.json', 'Astra_Email_Extractor_v2_FIXED.json'].forEach(file => {
  const wf = JSON.parse(fs.readFileSync(file, 'utf8'));

  const fetchNode = wf.nodes.find(n => n.name === 'Fetch Website');
  if (!fetchNode) { console.error(`${file}: Fetch Website not found`); return; }

  // Reduce timeout to 8 seconds, limit redirects, remove neverError (rely on continueOnFail instead)
  fetchNode.parameters.options = {
    timeout: 8000,
    allowUnauthorizedCerts: true,
    redirect: {
      redirect: {
        followRedirects: true,
        maxRedirects: 3
      }
    },
    response: {
      response: {
        responseFormat: "text",
        outputPropertyName: "html",
        fullResponse: false
      }
    }
  };

  // Make sure node-level fail handling is set
  fetchNode.continueOnFail = true;
  fetchNode.onError = "continueRegularOutput";
  fetchNode.retryOnFail = false;

  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  const opts = fetchNode.parameters.options;
  console.log(`${file}: done — timeout=${opts.timeout}ms, maxRedirects=${opts.redirect.redirect.maxRedirects}, continueOnFail=true, retryOnFail=false`);
});
