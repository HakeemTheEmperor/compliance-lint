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
