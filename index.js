module.exports = (info, logger, init) => {
    return init([
        "devices",
        "endpoints",
        "store",
        "vault"
    ], (scope, [
        C_DEVICES,
        C_ENDPOINTS,
        C_STORE,
        C_VAULT
    ]) => {

        logger.debug(`Hello from plugin "${info.name}"`);

        // setup device/store/vault items
        require("./setup.js")(logger, [
            C_DEVICES,
            C_STORE,
            C_VAULT
        ]);

        // fetch device/store/vault items & pass to fritzbox.js & handler.js
        // fritzbox.js setups request wrapper and methods
        // handler.js uses fritzbox.js methods for handling command & polling
        require("./bootstrap.js")(logger, [
            C_DEVICES,
            C_STORE,
            C_VAULT,
            C_ENDPOINTS
        ]);


        // used for trouble shooting http connection
        // for development purpose only
        //require("./debug.js")(logger, [C_DEVICES, C_STORE, C_VAULT])

    });
};