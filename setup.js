const {labels, name, host} = require("./definitions.js");

module.exports = (logger, [C_DEVICES, C_STORE, C_VAULT]) => {

    new Promise((resolve) => {
        C_DEVICES.found({
            labels
        }, resolve, (filter) => {

            C_DEVICES.add({
                name,
                icon: "fa-solid fa-wifi",
                labels: filter.labels,
                interfaces: [{
                    settings: {
                        host,
                        port: 80
                    }
                }]
            });

        });
    }).then((device) => {

        let store = new Promise((resolve) => {
            C_STORE.found({
                labels: [
                    `device=${device._id}`,
                    ...device.labels
                ]
            }, resolve, (filter) => {

                C_STORE.add({
                    name: device.name,
                    labels: filter.labels,
                    config: [{
                        name: "Polling interval",
                        description: "Interval for polling state changes",
                        key: "polling",
                        type: "number",
                        value: 5000
                    }]
                });

            });
        });

        let vault = new Promise((resolve) => {
            C_VAULT.found({
                labels: [
                    `device=${device._id}`,
                    ...device.labels
                ]
            }, resolve, (filter) => {

                C_VAULT.add({
                    name: device.name,
                    labels: filter.labels,
                    secrets: [{
                        name: "Username",
                        key: "USERNAME"
                    }, {
                        name: "Password",
                        key: "PASSWORD"
                    }, {
                        name: "Session ID",
                        key: "SESSION_ID"
                    }]                    
                });

            });
        });

        return Promise.all([device, store, vault]);

    }).then(([device, store, vault]) => {

        // how to get device here?
        logger.info("Setup device, store & vault complete");
        logger.verbose(device, store, vault);

    }).catch((err) => {

        logger.error(err, "Could not setup Fritz!Box plugin");

    });

};