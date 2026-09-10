import {describe, expect, it, vi} from 'vitest';
import {lazyMap} from '../../../src/utils/lazy-map';

describe('lazyMap', () => {
    it('returns an empty iterable when passed an empty iterable', () => {
        const fn = vi.fn();

        expect([...lazyMap([], fn)]).toEqual([]);
        expect([...lazyMap(new Set(), fn)]).toEqual([]);
        expect([...lazyMap(new Map(), fn)]).toEqual([]);

        expect(fn).not.toHaveBeenCalled();
    });

    it('returns a new iterator with values mapped lazily', () => {
        const fn = vi.fn((n: number) => n * n);

        const result = lazyMap([1, 2, 3], fn);

        expect(fn).not.toHaveBeenCalled();

        expect([...result]).toEqual([1, 4, 9]);

        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not "spend" the iterable when iterated', () => {
        const result = lazyMap([1, 2, 3], n => n * n);

        expect([...result]).toEqual([1, 4, 9]);
        expect([...result]).toEqual([1, 4, 9]);
        expect([...result]).toEqual([1, 4, 9]);
    });

    it('can map over an infinite iterable', () => {
        const everyNumber = {
            *[Symbol.iterator]() {
                for (let i = 0; true; i += 1) {
                    yield i;
                }
            }
        };

        const iterator = lazyMap(everyNumber, n => n * n)[Symbol.iterator]();

        expect(iterator.next()).toEqual({value: 0, done: false});
        expect(iterator.next()).toEqual({value: 1, done: false});
        expect(iterator.next()).toEqual({value: 4, done: false});
        expect(iterator.next()).toEqual({value: 9, done: false});
    });
});
