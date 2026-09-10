/**
 * Creates an iterable of values by running each element in `iterable` through `fn`.
 *
 * Similar to `Array.prototype.map`.
 *
 * It is effectively this:
 *
 * ```javascript
 * function* lazyMap(iterable, fn) {
 *   for (const value of iterable) {
 *     yield fn(value);
 *   }
 * }
 * ```
 *
 * (It avoids generators internally for performance, but that's an implementation detail.)
 *
 * @example
 * ```javascript
 * lazyMap(numbers, (n) => n * n);
 * // => Iterable yielding 1, 4, 9, 16, ...
 * ```
 */
export const lazyMap = <T, U>(
    iterable: Iterable<T>,
    fn: (value: T) => U
): Iterable<U> => new LazyMapIterable(iterable, fn);

class LazyMapIterable<T, U> implements Iterable<U> {
    #iterable: Iterable<T>;
    #fn: (value: T) => U;

    constructor(iterable: Iterable<T>, fn: (value: T) => U) {
        this.#iterable = iterable;
        this.#fn = fn;
    }

    [Symbol.iterator](): Iterator<U> {
        const iterator = this.#iterable[Symbol.iterator]();
        const fn = this.#fn;

        return {
            next() {
                const nextIteration = iterator.next();
                if (nextIteration.done) {
                    return nextIteration;
                } else {
                    return {
                        done: false,
                        value: fn(nextIteration.value)
                    };
                }
            }
        };
    }
}
