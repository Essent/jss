import { Component, Directive, makeEnvironmentProviders, NgModule } from '@angular/core';
import { JssModule } from '../lib.module';
import { DYNAMIC_COMPONENT } from './placeholder.token';
import { isComponentMap, isComponentType, isNgModuleType } from './lazy-component-load-result';

@Component({ standalone: true, template: '' })
class TestComponent {}

@Directive({ standalone: true })
class TestDirective {}

@NgModule({ imports: [JssModule.forChild(TestComponent)] })
class TestLazyNgModule {}

describe('lazy component load result checks', () => {
  const environmentProviders = makeEnvironmentProviders([
    { provide: DYNAMIC_COMPONENT, useValue: TestComponent },
  ]);

  it('detects component types', () => {
    expect(isComponentType(TestComponent)).toBeTrue();
    expect(isComponentType(TestDirective)).toBeFalse();
    expect(isComponentType(TestLazyNgModule)).toBeFalse();
    expect(isComponentType(environmentProviders)).toBeFalse();
  });

  it('treats every other class as an NgModule type', () => {
    expect(isNgModuleType(TestLazyNgModule)).toBeTrue();
    expect(isNgModuleType(TestDirective)).toBeTrue();
    expect(isNgModuleType(TestComponent)).toBeFalse();
    expect(isNgModuleType(environmentProviders)).toBeFalse();
    expect(isNgModuleType({ TestComponent })).toBeFalse();
  });

  it('detects non-empty component maps', () => {
    expect(isComponentMap({ TestComponent })).toBeTrue();
    expect(isComponentMap({})).toBeFalse();
    expect(isComponentMap({ TestComponent, TestDirective })).toBeFalse();
    expect(isComponentMap(environmentProviders)).toBeFalse();
    expect(isComponentMap(TestComponent)).toBeFalse();
    expect(isComponentMap(null)).toBeFalse();
  });
});
