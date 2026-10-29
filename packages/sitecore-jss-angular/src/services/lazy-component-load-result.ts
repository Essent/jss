import { reflectComponentType, Type } from '@angular/core';

// These checks use only the public reflectComponentType() API. Do not read private
// Angular fields such as ɵmod or ɵproviders here: a renamed field would not fail
// the build, but every lazy component would get the wrong loading path.

/**
 * Checks whether a lazy load result is a component type.
 * @param {unknown} value The lazy load result.
 */
export function isComponentType(value: unknown): value is Type<unknown> {
  return typeof value === 'function' && reflectComponentType(value as Type<unknown>) !== null;
}

/**
 * Checks whether a lazy load result is an NgModule type.
 * Every class that is not a component takes the NgModule path, as in upstream JSS.
 * @param {unknown} value The lazy load result.
 */
export function isNgModuleType(value: unknown): value is Type<unknown> {
  return typeof value === 'function' && !isComponentType(value);
}

/**
 * Checks whether a lazy load result is a non-empty map of component types.
 * Other objects are environment providers.
 * @param {unknown} value The lazy load result.
 */
export function isComponentMap(value: unknown): value is Record<string, Type<unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entries = Object.values(value);
  return entries.length > 0 && entries.every(isComponentType);
}
