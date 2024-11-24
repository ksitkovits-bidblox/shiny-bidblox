// backend/utils/storagePaths.js
const getStoragePath = (companyName, projectId, fileName = '') => {
  return `company-${companyName.toLowerCase()}/projects/${projectId}/files/${fileName}`.replace(/\/+$/, '');
};
  
  module.exports = { getStoragePath };