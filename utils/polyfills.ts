// Polyfills applied across both server and client environments
// Currently we only need to polyfill Promise.withResolvers for Node < 20.9

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof (Promise as any).withResolvers !== "function") {
  const polyfill = function withResolvers<T = any>() {
    let resolveFn: (value: T | PromiseLike<T>) => void
    let rejectFn: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
      resolveFn = res
      rejectFn = rej
    })
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return { promise, resolve: resolveFn!, reject: rejectFn! }
  }

  // Define the function as non-enumerable to mimic native behaviour
  Object.defineProperty(Promise, "withResolvers", {
    value: polyfill,
    writable: true,
    configurable: true,
  })
}
