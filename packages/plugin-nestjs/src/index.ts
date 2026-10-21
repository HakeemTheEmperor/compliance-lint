import { definePlugin } from "complinter/plugin-api";
import { piiInUrlRule } from "./pii-in-url";
import { unserializedSensitiveResponseRule } from "./unserialized-sensitive-response";

export { piiInUrlRule, unserializedSensitiveResponseRule };

/** NestJS rules for complinter. Add "@complinter/plugin-nestjs" to `plugins` in compliance.json. */
export const nestjsPlugin = definePlugin({
  name: "@complinter/plugin-nestjs",
  // A literal, not PLUGIN_API_VERSION: it pins the API generation this plugin
  // was written for, so an incompatible complinter refuses to load it.
  apiVersion: 1,
  namespace: "nestjs",
  rules: [piiInUrlRule, unserializedSensitiveResponseRule],
  defaultSeverities: {
    "nestjs/pii-in-url": "error",
    "nestjs/unserialized-sensitive-response": "error",
  },
});

export default nestjsPlugin;
