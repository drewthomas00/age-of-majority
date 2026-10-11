'use strict';

/**
 * Recursively freeze an object graph.
 *
 * `Object.freeze` is shallow, which is a poor fit for this library: the tables
 * ARE the product, and a shallow freeze leaves every nested version writable.
 * Any dependency in the process could set `MAJORITY['US-MS'].versions[0].age = 18`
 * and silently turn every 18-to-20-year-old in Mississippi into an adult, with
 * nothing to show for it in a diff.
 *
 * @template T
 * @param {T} value
 * @returns {Readonly<T>} the same reference, deeply frozen
 */
function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze(value[key]);
  }
  return value;
}

module.exports = { deepFreeze };
