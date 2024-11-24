// backend-gcs-service/types/project.js

/**
 * @typedef {Object} ProjectFile
 * @property {string} fileName
 * @property {string} fileUrl
 * @property {number} size
 * @property {string} mimeType
 * @property {string} uploadedAt
 */

/**
 * @typedef {Object} Analysis
 * @property {string} content
 * @property {string} generatedAt
 * @property {number} fileCount
 */

/**
 * @typedef {Analysis} ExecutiveSummary
 */

/**
 * @typedef {Object.<string, Analysis>} AnalysisResults
 */

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} rfpNumber
 * @property {string} name
 * @property {string} organization
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {('go'|'no-go'|'pending')} bidStatus
 * @property {ProjectFile[]} files
 * @property {ExecutiveSummary} [executiveSummary]
 * @property {AnalysisResults} [analyses]
 */

/**
 * @typedef {Object} AnalysisRequest
 * @property {string} prompt
 * @property {string} questionId
 * @property {boolean} [forceRegenerate]
 */

/**
 * @typedef {Object} AnalysisResponse
 * @property {string} analysis
 * @property {string} generatedAt
 * @property {boolean} wasRegenerated
 * @property {number} fileCount
 */

module.exports = {};