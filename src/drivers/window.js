import serializer from '../utils/serializer';
import Promise from '../utils/promise';
import executeCallback from '../utils/executeCallback';

const windowExist = typeof window !== 'undefined';

if (windowExist) {
    window.db = window.db || {};
}
const STORAGE = windowExist ? window.db : {};

function _initStorage(options) {
    const self = this;
    const dbInfo = {};
    if (options) {
        for (const i in options) {
            dbInfo[i] = options[i];
        }
    }

    dbInfo.keyPrefix = `${dbInfo.name}/`;

    if (dbInfo.storeName !== self._defaultConfig.storeName) {
        dbInfo.keyPrefix += `${dbInfo.storeName}/`;
    }

    self._dbInfo = dbInfo;
    dbInfo.serializer = serializer;

    return Promise.resolve();
}

// Remove all keys from the datastore, effectively destroying all data in
// the app's key/value store!
function clear(callback) {
    const self = this;
    const promise = self.ready().then(() => {
        const keyPrefix = self._dbInfo.keyPrefix;

        const keys = Object.keys(STORAGE);
        for (let i = keys.length - 1; i >= 0; i--) {
            const key = keys[i];

            if (key.indexOf(keyPrefix) === 0) {
                delete STORAGE[key];
            }
        }
    });

    executeCallback(promise, callback);
    return promise;
}

// Retrieve an item from the store. Unlike the original async_storage
// library in Gaia, we don't modify return values at all. If a key's value
// is `undefined`, we pass that value to the callback function.
function getItem(key, callback) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        console.warn(`${key} used as a key, but it is not a string.`);
        key = String(key);
    }

    const promise = self.ready().then(() => {
        const dbInfo = self._dbInfo;
        const result = STORAGE[dbInfo.keyPrefix + key];

        return result;
    });

    executeCallback(promise, callback);
    return promise;
}

// Iterate over all items in the store.
function iterate(iterator, callback) {
    const self = this;

    const promise = self.ready().then(() => {
        const dbInfo = self._dbInfo;
        const keyPrefix = dbInfo.keyPrefix;
        const keyPrefixLength = keyPrefix.length;
        const keys = Object.keys(STORAGE);
        const length = keys.length;

        // We use a dedicated iterator instead of the `i` variable below
        // so other keys we fetch in localStorage aren't counted in
        // the `iterationNumber` argument passed to the `iterate()`
        // callback.
        //
        // See: github.com/mozilla/localForage/pull/435#discussion_r38061530
        let iterationNumber = 1;

        for (let i = 0; i < length; i++) {
            const key = keys[i];
            if (key.indexOf(keyPrefix) !== 0) {
                continue;
            }
            let value = STORAGE[key];

            // If a result was found, parse it from the serialized
            // string into a JS object. If result isn't truthy, the
            // key is likely undefined and we'll pass it straight
            // to the iterator.
            if (value) {
                value = dbInfo.serializer.deserialize(value);
            }

            value = iterator(
                value,
                key.substring(keyPrefixLength),
                iterationNumber++
            );

            if (value !== void 0) {
                return value;
            }
        }
    });

    executeCallback(promise, callback);
    return promise;
}

// Same as localStorage's key() method, except takes a callback.
function key(n, callback) {
    const self = this;
    const keys = Object.keys(STORAGE);
    const promise = self.ready().then(() => {
        const dbInfo = self._dbInfo;
        let result;
        try {
            result = keys[n];
        } catch (error) {
            result = null;
        }

        // Remove the prefix from the key, if a key is found.
        if (result) {
            result = result.substring(dbInfo.keyPrefix.length);
        }

        return result;
    });

    executeCallback(promise, callback);
    return promise;
}

function keys(callback) {
    const self = this;
    const promise = self.ready().then(() => {
        const dbInfo = self._dbInfo;
        const output = [];
        const keys = Object.keys(STORAGE);

        for (let i = 0; i < keys.length; i++) {
            if (keys[i].indexOf(dbInfo.keyPrefix) === 0) {
                output.push(keys[i].substring(dbInfo.keyPrefix.length));
            }
        }

        return keys;
    });

    executeCallback(promise, callback);
    return promise;
}

// Supply the number of keys in the datastore to the callback function.
function length(callback) {
    const self = this;
    const promise = self.keys().then(keys => keys.length);

    executeCallback(promise, callback);
    return promise;
}

// Remove an item from the store, nice and simple.
function removeItem(key, callback) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        console.warn(`${key} used as a key, but it is not a string.`);
        key = String(key);
    }

    const promise = self.ready().then(() => {
        const dbInfo = self._dbInfo;
        delete STORAGE[dbInfo.keyPrefix + key];
    });

    executeCallback(promise, callback);
    return promise;
}

// Set a key's value and run an optional callback once the value is set.
// Unlike Gaia's implementation, the callback function is passed the value,
// in case you want to operate on that value only after you're sure it
// saved, or something like that.
function setItem(key, value, callback) {
    const self = this;

    // Cast the key to a string, as that's all we can set as a key.
    if (typeof key !== 'string') {
        console.warn(`${key} used as a key, but it is not a string.`);
        key = String(key);
    }

    const promise = self.ready().then(() => {
        // Convert undefined values to null.
        // https://github.com/mozilla/localForage/pull/42
        if (value === undefined) {
            value = null;
        }

        return new Promise(resolve => {
            const dbInfo = self._dbInfo;
            STORAGE[dbInfo.keyPrefix + key] = value;
            resolve(value);
        });
    });

    executeCallback(promise, callback);
    return promise;
}

const windowStorage = {
    _driver: 'windowStorage',
    _initStorage,
    // Default API, from Gaia/localStorage.
    iterate,
    getItem,
    setItem,
    removeItem,
    clear,
    length,
    key,
    keys
};

export default windowStorage;
