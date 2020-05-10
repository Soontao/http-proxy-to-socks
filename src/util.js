/**
 * generate random integer
 * 
 * @param {number} min number, will be included 
 * @param {number} max number, will NOT be included 
 */
const random_int = (min, max) => min + Math.floor(Math.random() * Math.floor(max - min));

module.exports = { random_int };
