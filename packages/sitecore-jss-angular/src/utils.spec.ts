import { firstValueFrom, isObservable, Observable, of, toArray } from 'rxjs';
import { wrapIntoObservable } from './utils';

/**
 * Collects all emitted values in an array, so that an emitted promise is not unwrapped.
 * @param {Observable<T>} value$ The observable to read.
 */
function emittedValues<T>(value$: Observable<T>): Promise<T[]> {
  return firstValueFrom(value$.pipe(toArray()));
}

describe('wrapIntoObservable', () => {
  it('emits the resolved value of a promise', async () => {
    const value = { redirect: true };

    expect(await emittedValues(wrapIntoObservable(Promise.resolve(value)))).toEqual([value]);
  });

  it('emits the resolved value of a thenable that is not a native promise', async () => {
    const thenable = { then: (resolve: (value: string) => void) => resolve('from thenable') };
    const value$ = wrapIntoObservable((thenable as unknown) as Promise<string>);

    expect(await emittedValues(value$)).toEqual(['from thenable']);
  });

  it('returns an observable as it is', () => {
    const value$ = of('from observable');

    expect(wrapIntoObservable(value$)).toBe(value$);
  });

  [false, 0, '', null, undefined, 'text', { then: 'not a function' }].forEach((value) => {
    it(`emits ${JSON.stringify(value)} as a plain value`, async () => {
      const value$ = wrapIntoObservable(value);

      expect(isObservable(value$)).toBeTrue();
      expect(await emittedValues(value$)).toEqual([value]);
    });
  });
});
