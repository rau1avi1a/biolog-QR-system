// // hooks/index.js
// 'use client';

// // Re-export from the working modules
// export { useMain as useCoreMain } from './core';
// export { useMain as useStateMain } from './state';

// // Simple object export
// export default {
//   core: {
//     useMain: null // Will be populated below
//   },
//   state: {
//     useMain: null // Will be populated below
//   }
// };

// // Dynamically populate after import
// import('./core').then(coreModule => {
//   exports.default.core.useMain = coreModule.useMain;
// });

// import('./state').then(stateModule => {
//   exports.default.state.useMain = stateModule.useMain;
// });