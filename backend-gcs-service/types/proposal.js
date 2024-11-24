/**
 * @typedef {Object} ChecklistItem
 * @property {string} id - Unique identifier for the checklist item
 * @property {string} text - The content/description of the checklist item
 * @property {boolean} completed - Whether the item has been completed
 * @property {string} [category] - Optional category for the checklist item
 */

/**
 * @typedef {Object} ProposalChecklist
 * @property {ChecklistItem[]} items - Array of checklist items
 * @property {string} generatedAt - ISO string of when the checklist was generated
 * @property {string} lastUpdated - ISO string of when the checklist was last updated
 */

/**
 * @typedef {'construction' | 'renovation' | 'infrastructure' | 'consulting'} ProposalCategory
 */

/**
 * @typedef {'draft' | 'in-progress' | 'review' | 'submitted' | 'cancelled'} ProposalStatus
 */

/**
 * @typedef {Object} Proposal
 * @property {string} id - Unique identifier for the proposal
 * @property {string} projectId - Associated project identifier
 * @property {string} projectName - Name of the project
 * @property {string} organization - Organization name
 * @property {ProposalCategory} category - Category of the proposal
 * @property {Date} dueDate - Due date for the proposal
 * @property {ProposalStatus} status - Current status of the proposal
 * @property {string} [generatedOutline] - Optional generated outline
 */

module.exports = {};  // Empty export to make this a proper module