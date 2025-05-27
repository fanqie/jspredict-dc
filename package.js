Package.describe({
  summary: "javascript port of predict open-source satellite tracking library",
  version: "1.2.0",
  name: "fanqie:jspredict_dc",
  git: "https://github.com/fanqie/jspredict-dc"
});

Package.onUse(function(api) {
  api.use("momentjs:moment@2.24.0");
  api.addFiles('satellite.js', ['client', 'server'], {
    bare: true
  });
  api.addFiles([
    "jspredict-dc.js",
    "export.js"
  ]);
  api.export("jspredict_dc");
});
