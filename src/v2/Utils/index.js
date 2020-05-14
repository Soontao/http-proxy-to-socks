
const runOnceWrapper = (func, onFirstTimeRun) => {
  let executed = false;
  return (...args) => {
    if (!executed) {
      executed = true;
      onFirstTimeRun(...args);
    }
    return func(...args);
  };
};

module.exports = { runOnceWrapper };