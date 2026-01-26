function throttle(callback, interval = 10) {

    let lastCall = 0;

    return function (...args) {

        const now = Date.now();

        if (now - lastCall >= interval) {
            lastCall = now;
            callback.apply(this, args);
        }

    };

}

const fritzbox = require("./fritzbox.js");
const handler = require("./handler.js")
const { labels } = require("./definitions.js");

module.exports = async (logger, [C_DEVICES, C_STORE, C_VAULT, C_ENDPOINTS]) => {

    let init = null;

    let device = await new Promise((resolve) => {
        C_DEVICES.found({
            labels
        }, resolve);
    });

    let store = await new Promise((resolve) => {
        C_STORE.found({
            labels: [
                ...labels,
                `device=${device._id}`
            ]
        }, resolve);
    });

    let vault = await new Promise((resolve) => {
        C_VAULT.found({
            labels: [
                ...labels,
                `device=${device._id}`
            ]
        }, resolve);
    });

    Promise.all([device, store, vault]).then(() => {

        logger.info("Bootstrap device handling");

        vault.changes().on("changed", (secret) => {

            logger.debug(`vault secrets "${secret.name}" changed`);
            init();

        });

        store.changes().on("changed", (key, value) => {

            logger.debug(`store variable changed ${key}=${value}`);
            init();

        });

        C_DEVICES.events.on("update", ({ _id }) => {
            if (_id === device._id) {

                logger.debug("Device updated, re-init");
                init();

            }
        });


        init = throttle(() => {
            try {

                let methods = fritzbox(logger, [
                    device,
                    store,
                    vault
                ], [
                    C_DEVICES,
                    C_ENDPOINTS
                ]);

                handler(logger, methods, [
                    device,
                    store,
                    vault
                ], [
                    C_DEVICES,
                    C_ENDPOINTS
                ], init);

            } catch (err) {

                logger.warn(err, "Something happend in fritzbox or handler");

            }
        }, 5000);


        init();

        /*
        let worker = debounce((redo) => {
            try {

                init = () => {

                    console.log("Init called redo");

                    redo();

                };

                let methods = fritzbox(logger, [
                    device,
                    store,
                    vault
                ], [
                    C_DEVICES,
                    C_ENDPOINTS
                ]);

                handler(logger, methods, [
                    device,
                    store,
                    vault
                ], [
                    C_DEVICES,
                    C_ENDPOINTS
                ], () => {

                    console.log("HAndler called redo!");

                    redo();

                });


            } catch (err) {

                logger.warn(err, "Something happend in fritzbox or handler");

            }
        }, 5000);

        infinity(worker, 10_000);
        */

    });


};