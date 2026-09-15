// Re-export canonical types from content-schema to avoid duplication
// Content-schema remains the single source of schemas; this package adds service behavior
import { Registry } from "@bible-compass/content-schema";

export type SourceRecord = Registry.SourceRecord;
export type SourceRelease = Registry.SourceRelease;
export type SourceArtifact = Registry.SourceArtifact;
export type RightsComponent = Registry.RightsComponent;
export type OperationGrant = Registry.OperationGrant;
export type ApprovalRecord = Registry.ApprovalRecord;
export type AuditReceipt = Registry.AuditReceipt;
export type AuthorizationRequest = Registry.AuthorizationRequest;
export type AuthorizationResult = Registry.AuthorizationResult;

export const sourceSchema = Registry.sourceSchema;
export const sourceReleaseSchema = Registry.sourceReleaseSchema;
export const sourceArtifactSchema = Registry.sourceArtifactSchema;
export const rightsComponentSchema = Registry.rightsComponentSchema;
export const operationGrantSchema = Registry.operationGrantSchema;
export const approvalRecordSchema = Registry.approvalRecordSchema;
export const auditReceiptSchema = Registry.auditReceiptSchema;
export const evaluateAuthorizationPure = Registry.evaluateAuthorization;
export const createAuditReceipt = Registry.createAuditReceipt;
export const validateComponentLicenseIsolation = Registry.validateComponentLicenseIsolation;
