const { Resolver } = require('dns').promises;

const resolver = new Resolver();

module.exports = { resolver };