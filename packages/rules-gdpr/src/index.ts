import { minimalDataCollectedRule } from "./gdpr/minimal-data-collected";
import { overlyBroadSelectRule } from "./gdpr/overly-broad-select";
import { dataRetentionMissingRule } from "./gdpr/data-retention-missing";
import { explicitPiiLoggingRule } from "./gdpr/explicit-pii-logging";
import { missingConsentFlagRule } from "./gdpr/missing-consent-flag";
import { missingErasureCascadeRule } from "./gdpr/missing-erasure-cascade";
import { piiUnhashedStorageRule } from "./gdpr/pii-unhashed-storage";
import { thirdPartyPiiLeakRule } from "./gdpr/third-party-pii-leak";
import { unencryptedPiiColumnRule } from "./gdpr/unencrypted-pii-column";
import { unprotectedExportRouteRule } from "./gdpr/unprotected-export-route";

import {
  PLUGIN_API_VERSION,
  definePlugin,
  type RuleSeverity,
} from "@complinter/core";

export const allRules = [
  minimalDataCollectedRule,
  overlyBroadSelectRule,
  dataRetentionMissingRule,
  explicitPiiLoggingRule,
  missingConsentFlagRule,
  missingErasureCascadeRule,
  piiUnhashedStorageRule,
  thirdPartyPiiLeakRule,
  unencryptedPiiColumnRule,
  unprotectedExportRouteRule,
];

/** Severity of each rule when the user's config does not say. */
export const defaultSeverities: Record<string, RuleSeverity> = {
  "gdpr/pii-unhashed-storage": "error",
  "gdpr/minimal-data-collected": "error",
  "gdpr/data-retention-missing": "warn",
  "gdpr/explicit-pii-logging": "error",
  "gdpr/overly-broad-select": "warn",
  "gdpr/missing-consent-flag": "error",
  "gdpr/missing-erasure-cascade": "error",
  "gdpr/third-party-pii-leak": "error",
  "gdpr/unencrypted-pii-column": "error",
  "gdpr/unprotected-export-route": "error",
};

/** The built-in GDPR rules, packaged like any other plugin. */
export const gdprPlugin = definePlugin({
  name: "@complinter/rules-gdpr",
  apiVersion: PLUGIN_API_VERSION,
  namespace: "gdpr",
  rules: allRules,
  defaultSeverities,
});
